// Sync Switch → Apps Familia (Boston). Reconstruido desde specs del sprint.
//
// Tres syncs, cada uno escribe una fila de auditoría en switch_sync_log:
//   - syncFacturas: facturas + notas crédito + notas débito (upsert idempotente)
//   - syncEstadocuenta: snapshot puntual de CxC (REPLACE all)
//   - syncCostoDiario: costo total de ventas por día del mes (upsert por fecha)
//
// Regla de oro: NUNCA descartar un row en silencio. Si un campo crítico no
// parsea, se agrega a skip_details y el status del sync pasa a 'partial'.
// Los nombres de campos crudos están confirmados contra el API real de Switch.

import { getSupabaseServer } from "@/lib/supabase-server";
import { createSwitchClient, parseMonto } from "./client";
import type { SkipDetail, SyncResult, SyncType, TipoComprobante } from "./types";

type RawRow = Record<string, unknown>;

function nowIso(): string {
  return new Date().toISOString();
}

function asStr(v: unknown): string | null {
  return v == null || v === "" ? null : String(v);
}

/** Parseo estricto de monto: devuelve null si no parsea (para decidir skips). */
function parseMontoStrict(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

/**
 * Bucket de antigüedad a partir de días vencido.
 * CRÍTICO: cortes con `<` (no `<=`) usando los límites superiores+1, así cada
 * bucket cubre su rango inclusivo exacto. Verificado borde por borde:
 *   30→0-30 · 31→31-60 · 60→31-60 · 120→91-120 · 121→121-180 · 180→121-180 ·
 *   181→181-270 · 365→271-365 · 366→+365.
 * (El bug histórico de fashiongr usaba límites mal puestos y perdía 121-180.)
 */
function bucketFromDias(dias: number): string {
  if (dias < 31)  return "0-30";    // 0..30
  if (dias < 61)  return "31-60";   // 31..60
  if (dias < 91)  return "61-90";   // 61..90
  if (dias < 121) return "91-120";  // 91..120
  if (dias < 181) return "121-180"; // 121..180
  if (dias < 271) return "181-270"; // 181..270
  if (dias < 366) return "271-365"; // 271..365
  return "+365";                     // 366+
}

/** Estado de cuenta usa fechas "DD-MM-YYYY". Devuelve "YYYY-MM-DD" o null. */
function parseFechaDMY(s: string | null | undefined): string | null {
  if (s == null) return null;
  const m = String(s).trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** Baja a data.estadocuenta.elements (array anidado 2 niveles). */
function digEstadoCuentaElements(data: unknown): RawRow[] {
  if (!data || typeof data !== "object") return [];
  const ec = (data as Record<string, unknown>)["estadocuenta"];
  if (!ec || typeof ec !== "object") return [];
  const els = (ec as Record<string, unknown>)["elements"];
  return Array.isArray(els) ? (els as RawRow[]) : [];
}

async function logSync(r: SyncResult): Promise<void> {
  try {
    const db = getSupabaseServer();
    // Net-zero NO es skip ni fallo: se registra como entrada-resumen en el JSONB
    // del log (visibilidad) pero NO suma a rows_skipped ni cambia el status.
    const skipDetailsLog =
      r.excludedNetZero && r.excludedNetZero > 0
        ? [
            ...r.skipDetails,
            { entidad: "estadocuenta", identificador: "(resumen)", campo: "clientes_net_zero_excluidos", valorCrudo: String(r.excludedNetZero), motivo: "saldo neto ~0 (pagados); no listados en reporte oficial" },
          ]
        : r.skipDetails;
    await db.from("switch_sync_log").insert({
      sync_type: r.syncType,
      started_at: r.startedAt,
      finished_at: r.finishedAt,
      status: r.status,
      rows_synced: r.rowsSynced,
      rows_skipped: r.rowsSkipped,
      skip_details: skipDetailsLog,
      error_message: r.errorMessage ?? null,
    });
  } catch (e) {
    // El log de auditoría no debe tumbar el sync.
    console.error("[switch-sync] no se pudo escribir switch_sync_log:", e);
  }
}

function errorResult(syncType: SyncType, startedAt: string, skipDetails: SkipDetail[], rowsSynced: number, err: unknown): SyncResult {
  return {
    syncType,
    status: "error",
    rowsSynced,
    rowsSkipped: skipDetails.length,
    skipDetails,
    errorMessage: err instanceof Error ? err.message : String(err),
    startedAt,
    finishedAt: nowIso(),
  };
}

// ─── Facturas + Notas Crédito + Notas Débito ──────────────────────────────────

const COMPROBANTE_ENDPOINTS: { endpoint: string; tipo: TipoComprobante }[] = [
  { endpoint: "/apifactura/lista", tipo: "Factura" },
  { endpoint: "/apinotacredito/lista", tipo: "Nota de Credito" },
  { endpoint: "/apinotadebito/lista", tipo: "Nota de Debito" },
];

// Campos reales del payload de Switch (confirmados contra /apifactura/lista):
//   id, secuencial, tipoComprobante, fecha ("YYYY-MM-DD HH:mm:ss"), subTotal,
//   descuento, subTotalDescuento, impuesto, total, cliente, clienteId (num),
//   vendedor, vendedorId (num), sucursal, sucursalId (num), saldo, condicionVenta.
function mapComprobante(raw: RawRow, tipo: TipoComprobante): { row?: RawRow; skip?: SkipDetail } {
  const id = raw["id"];
  const secuencial = asStr(raw["secuencial"]);
  const fechaRaw = asStr(raw["fecha"]);
  const facturaId = id != null && id !== "" ? String(id) : null;
  const ident = facturaId ?? secuencial ?? "(desconocido)";

  if (!facturaId || !secuencial || !fechaRaw) {
    return {
      skip: {
        entidad: tipo,
        identificador: ident,
        campo: "id/secuencial/fecha",
        valorCrudo: JSON.stringify({ id, secuencial, fecha: fechaRaw }),
        motivo: "campo clave ausente",
      },
    };
  }

  // fecha viene "YYYY-MM-DD HH:mm:ss" → guardar solo la parte fecha (col DATE).
  const fecha = fechaRaw.split(/[ T]/)[0];

  const subtotalDescuento = parseMontoStrict(raw["subTotalDescuento"]);
  if (subtotalDescuento == null) {
    return {
      skip: { entidad: tipo, identificador: ident, campo: "subTotalDescuento", valorCrudo: String(raw["subTotalDescuento"] ?? ""), motivo: "no parseable" },
    };
  }

  const total = parseMontoStrict(raw["total"]);
  if (total == null) {
    return {
      skip: { entidad: tipo, identificador: ident, campo: "total", valorCrudo: String(raw["total"] ?? ""), motivo: "no parseable" },
    };
  }

  const clienteId = raw["clienteId"];
  const vendedorId = raw["vendedorId"];
  const sucursalId = raw["sucursalId"];
  const idToStr = (v: unknown) => (v != null && v !== "" ? String(v) : null);

  return {
    row: {
      factura_id: facturaId,                    // ← id
      numero: secuencial,                       // ← secuencial
      fecha,                                    // ← fecha (solo parte fecha)
      cliente_codigo: idToStr(clienteId),       // ← String(clienteId) (numérico, no D-XX)
      cliente_nombre: asStr(raw["cliente"]),    // ← cliente
      vendedor_codigo: idToStr(vendedorId),     // ← String(vendedorId)
      vendedor_nombre: asStr(raw["vendedor"]),  // ← vendedor
      subtotal: parseMonto(raw["subTotal"] as string),            // ← subTotal
      subtotal_descuento: subtotalDescuento,    // ← subTotalDescuento (base reportes)
      itbms: parseMonto(raw["impuesto"] as string),               // ← impuesto
      total,                                    // ← total
      // tipo canónico del endpoint (no del payload) → consistencia con
      // UNIQUE(factura_id, tipo_comprobante) y la vista switch_ventas_netas_vw.
      tipo_comprobante: tipo,
      is_wholesale: false,                      // Boston retail; refinar después
      sucursal_codigo: idToStr(sucursalId),     // ← String(sucursalId)
      raw_data: raw,
    },
  };
}

const UPSERT_BATCH = 100;

export async function syncFacturas(opts: { desde: string; hasta: string }): Promise<SyncResult> {
  const startedAt = nowIso();
  const skipDetails: SkipDetail[] = [];
  let rowsSynced = 0;

  try {
    const client = createSwitchClient();
    const db = getSupabaseServer();

    // Buffer + persistencia en batches de 100 para no reventar por statement timeout.
    const buffer: RawRow[] = [];
    const persist = async (batch: RawRow[]) => {
      if (batch.length === 0) return;
      const { error } = await db
        .from("switch_facturas")
        .upsert(batch, { onConflict: "factura_id,tipo_comprobante" });
      if (error) throw new Error(`upsert switch_facturas: ${error.message}`);
      rowsSynced += batch.length;
    };

    for (const { endpoint, tipo } of COMPROBANTE_ENDPOINTS) {
      const raw = await client.getPaginated<RawRow>(endpoint, { desde: opts.desde, hasta: opts.hasta }, 50);
      for (const r of raw) {
        const mapped = mapComprobante(r, tipo);
        if (mapped.skip) {
          skipDetails.push(mapped.skip);
          continue;
        }
        if (mapped.row) buffer.push(mapped.row);
        if (buffer.length >= UPSERT_BATCH) {
          await persist(buffer.splice(0, UPSERT_BATCH));
        }
      }
    }
    // Persistir el remanente del buffer.
    await persist(buffer.splice(0, buffer.length));

    const result: SyncResult = {
      syncType: "facturas",
      status: skipDetails.length > 0 ? "partial" : "success",
      rowsSynced,
      rowsSkipped: skipDetails.length,
      skipDetails,
      startedAt,
      finishedAt: nowIso(),
    };
    await logSync(result);
    return result;
  } catch (err) {
    const result = errorResult("facturas", startedAt, skipDetails, rowsSynced, err);
    await logSync(result);
    return result;
  }
}

// ─── Estado de cuenta (CxC) — SECUENCIAL con cursor reanudable ────────────────
//
// No hay endpoint global de antigüedad en Switch: /apicliente/estadocuenta es
// PER-CLIENTE (requiere clienteId). Diseño robusto para ~361 clientes sin timeout:
//   1) Una "vuelta" = barrer todos los clientes UNA vez. Su lista + runStamp se
//      guardan en switch_sync_cursor para poder reanudar entre corridas del cron.
//   2) Se procesa de a UN cliente (SECUENCIAL) — Switch tiene SESIÓN ÚNICA: dos
//      logins en paralelo se matan entre sí (codigo 0006) → re-logins que alargan
//      el tiempo. Secuencial = un solo request a la vez = sin colisión de token.
//   3) Se procesa mientras haya TIEMPO SEGURO (EC_TIME_BUDGET_MS). Al agotarse,
//      se guarda el cursor y se devuelve "partial-cursor" (el cron encadena la
//      siguiente corrida). NO se corre el reconcile global hasta terminar la vuelta.
//   4) REPLACE per-cliente: por cada cliente consultado OK se borran sus filas de
//      este runStamp (idempotencia ante re-proceso tras un corte), se insertan las
//      nuevas, y se borran sus filas de vueltas anteriores (< runStamp). Así el
//      cliente YA procesado nunca queda doble-contado, y los AÚN NO procesados
//      conservan intacta su data vieja (nunca caen a $0 a mitad de vuelta).
//   5) Falla transitoria (red/timeout/429): el cliente NO entra al reconcile →
//      conserva su saldo viejo. Net-zero (pagó todo): se borran sus filas → $0.
//   6) Al terminar la vuelta: reconcile global de respaldo (queriedCodigos) y se
//      limpia el cursor.

const EC_TIME_BUDGET_MS = 240_000;  // ~240s: parar antes del límite del plan (300 Pro)
const EC_PERSIST_EVERY = 20;        // checkpoint del cursor cada N clientes procesados

interface ClienteRef { id: number; nombre: string | null }

interface CajaCursor {
  runStamp: string;          // runStamp de la vuelta (lo usa el reconcile)
  clientes: ClienteRef[];    // lista completa de la vuelta (estable entre corridas)
  offsetIdx: number;         // próximo índice a procesar
  queriedCodigos: string[];  // acumulado de clientes consultados OK (para el reconcile)
}

type DB = ReturnType<typeof getSupabaseServer>;

async function loadEcCursor(db: DB): Promise<CajaCursor | null> {
  const { data } = await db
    .from("switch_sync_cursor")
    .select("run_stamp, clientes, offset_idx, queried_codigos")
    .eq("sync_type", "estadocuenta")
    .maybeSingle();
  if (!data) return null;
  return {
    runStamp: String(data.run_stamp),
    clientes: Array.isArray(data.clientes) ? (data.clientes as ClienteRef[]) : [],
    offsetIdx: typeof data.offset_idx === "number" ? data.offset_idx : 0,
    queriedCodigos: Array.isArray(data.queried_codigos) ? (data.queried_codigos as string[]) : [],
  };
}

async function saveEcCursor(db: DB, c: CajaCursor): Promise<void> {
  const { error } = await db.from("switch_sync_cursor").upsert(
    {
      sync_type: "estadocuenta",
      run_stamp: c.runStamp,
      clientes: c.clientes,
      offset_idx: c.offsetIdx,
      queried_codigos: c.queriedCodigos,
      total: c.clientes.length,
      updated_at: nowIso(),
    },
    { onConflict: "sync_type" },
  );
  if (error) throw new Error(`save switch_sync_cursor: ${error.message}`);
}

async function clearEcCursor(db: DB): Promise<void> {
  await db.from("switch_sync_cursor").delete().eq("sync_type", "estadocuenta");
}

function mapEstadoCuentaRow(
  clienteCodigo: string,
  clienteNombre: string | null,
  el: RawRow,
): { row?: RawRow; skip?: SkipDetail } {
  const ccteId = el["ccteId"];
  const secuencial = asStr(el["secuencial"]);
  const ident = ccteId != null ? String(ccteId) : secuencial ?? "(sin id)";

  // Saldo NETO del documento = debito - credito. El campo `saldo` crudo NO netea:
  // Recibos (pagos), Notas de Crédito, etc. vienen con saldo positivo pero son del
  // lado crédito (reducen la cuenta). Validado al centavo: sum(debito-credito) =
  // $194,775.96 = reporte oficial de Boston. Sumar `saldo` daría $351,850 (inflado).
  const debito = parseMontoStrict(el["debito"]);
  const credito = parseMontoStrict(el["credito"]);
  if (debito == null && credito == null) {
    return { skip: { entidad: "estadocuenta", identificador: ident, campo: "debito/credito", valorCrudo: JSON.stringify({ debito: el["debito"], credito: el["credito"] }), motivo: "no parseable" } };
  }
  const saldo = (debito ?? 0) - (credito ?? 0);

  const diasRaw = el["dias"];
  const dias = typeof diasRaw === "number" ? diasRaw : Number(diasRaw);
  const diasVencido = Number.isFinite(dias) ? dias : null;

  return {
    row: {
      cliente_codigo: clienteCodigo,                       // String(cliente.id) — consistente con facturas
      cliente_nombre: clienteNombre,
      factura_numero: secuencial,                          // ← secuencial
      fecha_emision: parseFechaDMY(asStr(el["fechaCreacion"])), // DD-MM-YYYY → YYYY-MM-DD
      fecha_vencimiento: null,                             // Switch no da fecha de vencimiento; usamos dias
      dias_vencido: diasVencido,                           // ← dias
      bucket: diasVencido == null ? null : bucketFromDias(diasVencido),
      saldo,                                               // ← saldo
    },
  };
}

export async function syncEstadocuenta(): Promise<SyncResult> {
  const startedAt = nowIso();
  const startMs = Date.now();
  const skipDetails: SkipDetail[] = [];
  let rowsSynced = 0;

  try {
    const client = createSwitchClient();
    const db = getSupabaseServer();

    // ── Arranque: RED DE SEGURIDAD del cursor ──
    // Si YA existe un cursor (vuelta a medias) se RETOMA con su MISMO runStamp, sin
    // importar su antigüedad — nunca se descarta. Así, aunque el auto-encadenado
    // falle un día, el cron diario siguiente continúa la vuelta vieja desde donde
    // quedó (offsetIdx) y siempre la termina, sin perder data y sin necesitar Pro.
    // Solo se arranca una vuelta NUEVA cuando el cursor está LIMPIO (no hay fila =
    // la vuelta anterior se completó y se borró el cursor). Un cursor incompleto
    // SIEMPRE tiene prioridad sobre arrancar una vuelta nueva.
    let cursor = await loadEcCursor(db);
    // Un cursor "vacío" (sin clientes, p.ej. por un guardado a medias) no sirve para
    // reanudar → se trata como limpio y se re-lista. No se queda trabado.
    if (cursor && cursor.clientes.length === 0) {
      await clearEcCursor(db);
      cursor = null;
    }
    const resumed = cursor !== null;
    if (cursor) {
      const ageH = Math.round((Date.now() - new Date(cursor.runStamp).getTime()) / 3_600_000);
      console.error(`[estadocuenta] RETOMA vuelta a medias: offset ${cursor.offsetIdx}/${cursor.clientes.length} (cursor de ~${ageH}h atrás)`);
    } else {
      // Vuelta NUEVA: listar todos los clientes (getPaginated corta por
      // paginacion.total) y fijar el runStamp de la vuelta en el cursor.
      const clientesRaw = await client.getPaginated<RawRow>("/apicliente/lista", {}, 50);
      const clientes: ClienteRef[] = clientesRaw.map((c) => ({
        id: typeof c["id"] === "number" ? (c["id"] as number) : NaN,
        nombre: asStr(c["nombre"]),
      }));
      cursor = { runStamp: startedAt, clientes, offsetIdx: 0, queriedCodigos: [] };
      await saveEcCursor(db, cursor);
      console.error(`[estadocuenta] vuelta NUEVA: ${clientes.length} clientes`);
    }

    const runStamp = cursor.runStamp;                          // runStamp de ESTA vuelta (reconcile usa este)
    const queriedSet = new Set<string>(cursor.queriedCodigos); // acumulado entre corridas parciales
    let excludedNetZero = 0;

    const persistCursor = async (offsetIdx: number) =>
      saveEcCursor(db, { runStamp, clientes: cursor!.clientes, offsetIdx, queriedCodigos: Array.from(queriedSet) });

    // REPLACE idempotente per-cliente: borra sus filas de ESTE runStamp (por si es
    // re-proceso tras un corte), inserta las nuevas, y borra sus filas de vueltas
    // ANTERIORES (< runStamp). Así el cliente ya procesado nunca queda doble-contado,
    // y los AÚN NO procesados no se tocan (conservan su saldo viejo, nunca caen a $0).
    const replaceCliente = async (codigo: string, rows: RawRow[]) => {
      await db.from("switch_estadocuenta").delete().eq("cliente_codigo", codigo).eq("synced_at", runStamp);
      if (rows.length > 0) {
        const stamped = rows.map((r) => ({ ...r, synced_at: runStamp }));
        const { error } = await db.from("switch_estadocuenta").insert(stamped);
        if (error) throw new Error(`insert switch_estadocuenta: ${error.message}`);
        rowsSynced += rows.length;
      }
      const { error: delErr } = await db.from("switch_estadocuenta").delete().eq("cliente_codigo", codigo).lt("synced_at", runStamp);
      if (delErr) throw new Error(`reconcile per-cliente switch_estadocuenta: ${delErr.message}`);
    };

    // ── Procesar SECUENCIAL desde el offset, dentro del presupuesto de tiempo ──
    let i = cursor.offsetIdx;
    let processed = 0;
    for (; i < cursor.clientes.length; i++) {
      if (Date.now() - startMs > EC_TIME_BUDGET_MS) break;  // se acabó el tiempo seguro

      const cli = cursor.clientes[i];
      if (!Number.isFinite(cli.id)) {
        skipDetails.push({ entidad: "estadocuenta", identificador: "(sin id)", campo: "cliente_id", valorCrudo: String(cli.nombre ?? ""), motivo: "cliente sin id numérico" });
        processed++;
        if (processed % EC_PERSIST_EVERY === 0) await persistCursor(i + 1);
        continue;
      }
      const codigo = String(cli.id);

      let elements: RawRow[];
      try {
        const data = await client.get("/apicliente/estadocuenta", { clienteId: cli.id });
        elements = digEstadoCuentaElements(data);
      } catch (err) {
        // Falla transitoria: NO entra al reconcile → conserva su data vieja.
        skipDetails.push({ entidad: "estadocuenta", identificador: codigo, campo: "getEstadoCuenta", valorCrudo: err instanceof Error ? err.message : String(err), motivo: "fallo al consultar (excluido del reconcile)" });
        processed++;
        if (processed % EC_PERSIST_EVERY === 0) await persistCursor(i + 1);
        continue;
      }

      // Consulta exitosa → participa del reconcile (incluso si es net-zero).
      queriedSet.add(codigo);

      // Acumular las filas del cliente y su saldo NETO antes de decidir.
      const clientRows: RawRow[] = [];
      let netoCliente = 0;
      for (const el of elements) {
        const mapped = mapEstadoCuentaRow(codigo, cli.nombre, el);
        if (mapped.skip) { skipDetails.push(mapped.skip); continue; }
        if (mapped.row) { clientRows.push(mapped.row); netoCliente += Number(mapped.row["saldo"]) || 0; }
      }

      // Net-zero (pagó todo): no insertamos filas, pero el replace borra sus filas
      // viejas → queda en $0 (correcto). Igual entra a queriedSet.
      if (Math.abs(netoCliente) < 0.01) {
        excludedNetZero++;
        await replaceCliente(codigo, []);
      } else {
        await replaceCliente(codigo, clientRows);
      }

      processed++;
      if (processed % EC_PERSIST_EVERY === 0) await persistCursor(i + 1);
    }

    const completed = i >= cursor.clientes.length;

    if (!completed) {
      // ── Vuelta a medias: guardar el cursor y terminar parcial. SIN reconcile global. ──
      await persistCursor(i);
      const result: SyncResult = {
        syncType: "estadocuenta",
        status: "partial-cursor",
        rowsSynced,
        rowsSkipped: skipDetails.length,
        skipDetails,
        excludedNetZero,
        remaining: cursor.clientes.length - i,
        resumed,
        startedAt,
        finishedAt: nowIso(),
      };
      await logSync(result);
      return result;
    }

    // ── Vuelta COMPLETA: reconcile global de respaldo (el replace per-cliente ya
    //    dejó cada cliente consultado en su estado final; esto barre cualquier
    //    remanente < runStamp de los queriedCodigos) y se limpia el cursor. ──
    const queriedCodigos = Array.from(queriedSet);
    for (let j = 0; j < queriedCodigos.length; j += 200) {
      const chunk = queriedCodigos.slice(j, j + 200);
      const { error } = await db
        .from("switch_estadocuenta")
        .delete()
        .in("cliente_codigo", chunk)
        .lt("synced_at", runStamp);
      if (error) throw new Error(`reconcile switch_estadocuenta: ${error.message}`);
    }

    // SYNC-3: limpiar clientes FANTASMA — los que ya NO existen en el maestro de
    // Switch (estaban en una vuelta previa pero fueron eliminados/desactivados).
    // El maestro completo de ESTA vuelta es cursor.clientes; cualquier fila de
    // switch_estadocuenta con un cliente_codigo fuera de ese conjunto es un
    // fantasma con saldo viejo → se borra. Los que fallaron transitoriamente SIGUEN
    // en cursor.clientes (vienen del maestro), así que se conservan. Solo en vuelta
    // COMPLETA y solo si el maestro no vino vacío (guardia anti-borrado-total).
    const validCodigos = cursor.clientes
      .map((c) => String(c.id))
      .filter((c) => c && c !== "NaN");
    if (validCodigos.length > 0) {
      const inList = `(${validCodigos.map((c) => `"${c}"`).join(",")})`;
      const { error: ghostErr } = await db
        .from("switch_estadocuenta")
        .delete()
        .not("cliente_codigo", "in", inList);
      if (ghostErr) throw new Error(`reconcile fantasmas switch_estadocuenta: ${ghostErr.message}`);
    }

    await clearEcCursor(db);
    console.error(`[estadocuenta] vuelta completa. net-zero excluidos: ${excludedNetZero}`);

    const result: SyncResult = {
      syncType: "estadocuenta",
      status: skipDetails.length > 0 ? "partial" : "success",
      rowsSynced,
      rowsSkipped: skipDetails.length,
      skipDetails,
      excludedNetZero,
      resumed,
      startedAt,
      finishedAt: nowIso(),
    };
    await logSync(result);
    return result;
  } catch (err) {
    const result = errorResult("estadocuenta", startedAt, skipDetails, rowsSynced, err);
    await logSync(result);
    return result;
  }
}

// ─── Costo diario ─────────────────────────────────────────────────────────────

/**
 * Costo diario del MES EN CURSO. OJO: /apireporte/totalventas?tipo=03 IGNORA el
 * parámetro `mes` — siempre devuelve el mes actual. No hay backfill histórico por
 * este endpoint (igual que getReporteMesActual de fashiongr). El arg `mes` se
 * mantiene por firma/compat pero no filtra nada.
 *
 * Shape: data.totales es un OBJETO indexado por día ("1".."31"), no un array.
 * Cada valor: { total, costo, utilidad, etiqueta, fecha("DD-MM-YYYY") }.
 */
export async function syncCostoDiario(mes: string): Promise<SyncResult> {
  void mes; // ignorado por el endpoint (ver doc arriba)
  const startedAt = nowIso();
  const skipDetails: SkipDetail[] = [];

  try {
    const client = createSwitchClient();
    const db = getSupabaseServer();

    const data = await client.get<unknown>("/apireporte/totalventas", { tipo: "03" });
    // data.totales = objeto { "1": {...}, "2": {...} } → iterar sus valores.
    const totales = (data as Record<string, unknown> | null)?.["totales"];
    const dias: RawRow[] = totales && typeof totales === "object"
      ? (Object.values(totales as Record<string, unknown>).filter((v) => v && typeof v === "object") as RawRow[])
      : [];
    const rows: RawRow[] = [];

    for (const r of dias) {
      const fecha = parseFechaDMY(asStr(r["fecha"]));   // "DD-MM-YYYY" → "YYYY-MM-DD"
      const costo = parseMontoStrict(r["costo"]);        // string US con coma de miles
      if (!fecha || costo == null) {
        skipDetails.push({
          entidad: "costo_diario",
          identificador: asStr(r["fecha"]) ?? "(sin fecha)",
          campo: "fecha/costo",
          valorCrudo: JSON.stringify({ fecha: r["fecha"], costo: r["costo"] }),
          motivo: "campo clave ausente/no parseable",
        });
        continue;
      }
      rows.push({ fecha, costo_total: costo });
    }

    if (rows.length > 0) {
      const { error } = await db.from("switch_costo_diario").upsert(rows, { onConflict: "fecha" });
      if (error) throw new Error(`upsert switch_costo_diario: ${error.message}`);
    }

    const result: SyncResult = {
      syncType: "costo_diario",
      status: skipDetails.length > 0 ? "partial" : "success",
      rowsSynced: rows.length,
      rowsSkipped: skipDetails.length,
      skipDetails,
      startedAt,
      finishedAt: nowIso(),
    };
    await logSync(result);
    return result;
  } catch (err) {
    const result = errorResult("costo_diario", startedAt, skipDetails, 0, err);
    await logSync(result);
    return result;
  }
}
