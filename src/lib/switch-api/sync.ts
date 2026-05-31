// Sync Switch → Apps Familia (Boston). Reconstruido desde specs del sprint.
//
// Tres syncs, cada uno escribe una fila de auditoría en switch_sync_log:
//   - syncFacturas: facturas + notas crédito + notas débito (upsert idempotente)
//   - syncEstadocuenta: snapshot puntual de CxC (REPLACE all)
//   - syncCostoDiario: costo total de ventas por día del mes (upsert por fecha)
//
// Regla de oro: NUNCA descartar un row en silencio. Si un campo crítico no
// parsea, se agrega a skip_details y el status del sync pasa a 'partial'.
//
// Los nombres de campos crudos del API de Switch son candidatos razonables
// (firstKey prueba varios); se confirman contra el API real cuando existan las
// env vars. raw_data guarda el payload completo para reconciliar.

import { getSupabaseServer } from "@/lib/supabase-server";
import { createSwitchClient, parseMonto } from "./client";
import type { SkipDetail, SyncResult, SyncType, TipoComprobante } from "./types";

type RawRow = Record<string, unknown>;

function nowIso(): string {
  return new Date().toISOString();
}

/** Primer key presente y no-vacío de una lista de candidatos. */
function firstKey(raw: RawRow, keys: string[]): unknown {
  for (const k of keys) {
    const v = raw[k];
    if (v != null && v !== "") return v;
  }
  return null;
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

// ─── Estado de cuenta (CxC) — iterativo por cliente, como fashiongr ───────────
//
// No hay endpoint global de antigüedad en Switch: /apicliente/estadocuenta es
// PER-CLIENTE (requiere clienteId). Diseño:
//   1) Listar TODOS los clientes vía /apicliente/lista (getPaginated corta por
//      paginacion.total, no por page*size — Switch capa porPagina en silencio).
//   2) Por cada cliente, GET /apicliente/estadocuenta?clienteId=<id>, en lotes
//      de 10 en paralelo. El array está en data.estadocuenta.elements.
//   3) Reconcile: REPLACE solo de los clientes consultados con éxito. Los que
//      fallan (red/timeout/429) NO se reconcilian → conservan su saldo viejo
//      (una falla transitoria no debe poner su CxC en $0 falsamente).

const EC_CONCURRENCY = 10;

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
  const runStamp = startedAt;
  const skipDetails: SkipDetail[] = [];
  let rowsSynced = 0;

  try {
    const client = createSwitchClient();
    const db = getSupabaseServer();

    // 1) Todos los clientes (getPaginated corta por paginacion.total).
    const clientesRaw = await client.getPaginated<RawRow>("/apicliente/lista", {}, 50);

    // 2) Estado de cuenta por cliente, en lotes de EC_CONCURRENCY en paralelo.
    const queriedCodigos: string[] = [];   // clientes consultados OK → entran al reconcile
    const buffer: RawRow[] = [];
    let excludedNetZero = 0;                // clientes con saldo neto ~0 (pagados): no se insertan

    const persist = async (batch: RawRow[]) => {
      if (batch.length === 0) return;
      const stamped = batch.map((r) => ({ ...r, synced_at: runStamp }));
      const { error } = await db.from("switch_estadocuenta").insert(stamped);
      if (error) throw new Error(`insert switch_estadocuenta: ${error.message}`);
      rowsSynced += batch.length;
    };

    for (let i = 0; i < clientesRaw.length; i += EC_CONCURRENCY) {
      const grupo = clientesRaw.slice(i, i + EC_CONCURRENCY);
      const resultados = await Promise.all(
        grupo.map(async (c) => {
          const id = c["id"];
          const codigo = id != null && id !== "" ? String(id) : null;
          const nombre = asStr(c["nombre"]);
          if (codigo == null || typeof id !== "number") {
            return { codigo: null, nombre, elements: null as RawRow[] | null, error: "cliente sin id numérico" };
          }
          try {
            const data = await client.get("/apicliente/estadocuenta", { clienteId: id });
            return { codigo, nombre, elements: digEstadoCuentaElements(data), error: null as string | null };
          } catch (err) {
            return { codigo, nombre, elements: null as RawRow[] | null, error: err instanceof Error ? err.message : String(err) };
          }
        }),
      );

      for (const r of resultados) {
        if (r.codigo == null) {
          skipDetails.push({ entidad: "estadocuenta", identificador: "(sin id)", campo: "cliente_id", valorCrudo: String(r.nombre ?? ""), motivo: "cliente sin id numérico" });
          continue;
        }
        if (r.error != null || r.elements == null) {
          // Falla transitoria: NO entra al reconcile → conserva su data vieja.
          skipDetails.push({ entidad: "estadocuenta", identificador: r.codigo, campo: "getEstadoCuenta", valorCrudo: r.error ?? "", motivo: "fallo al consultar (excluido del reconcile)" });
          continue;
        }
        // Consulta exitosa → participa del reconcile (incluso si es net-zero).
        queriedCodigos.push(r.codigo);

        // Acumular las filas del cliente y su saldo NETO antes de decidir.
        const clientRows: RawRow[] = [];
        let netoCliente = 0;
        for (const el of r.elements) {
          const mapped = mapEstadoCuentaRow(r.codigo, r.nombre, el);
          if (mapped.skip) { skipDetails.push(mapped.skip); continue; }
          if (mapped.row) { clientRows.push(mapped.row); netoCliente += Number(mapped.row["saldo"]) || 0; }
        }

        // Net-zero (pagó todo): el reporte oficial NO lista no-deudores → no
        // insertamos sus filas. NO es fallo ni skip: ya está en queriedCodigos,
        // así que el reconcile borra sus filas viejas (queda sin saldo, correcto).
        if (Math.abs(netoCliente) < 0.01) {
          excludedNetZero++;
          continue;
        }

        buffer.push(...clientRows);
        while (buffer.length >= UPSERT_BATCH) {
          await persist(buffer.splice(0, UPSERT_BATCH));
        }
      }
    }
    await persist(buffer.splice(0, buffer.length));
    console.error(`[estadocuenta] clientes net-zero excluidos: ${excludedNetZero}`);

    // 3) Reconcile: borrar las filas VIEJAS (synced_at < runStamp) SOLO de los
    //    clientes consultados con éxito. Los recién insertados llevan
    //    synced_at = runStamp y sobreviven. Los clientes que fallaron no están
    //    en queriedCodigos → su data vieja queda intacta.
    for (let i = 0; i < queriedCodigos.length; i += 200) {
      const chunk = queriedCodigos.slice(i, i + 200);
      const { error } = await db
        .from("switch_estadocuenta")
        .delete()
        .in("cliente_codigo", chunk)
        .lt("synced_at", runStamp);
      if (error) throw new Error(`reconcile switch_estadocuenta: ${error.message}`);
    }

    const result: SyncResult = {
      syncType: "estadocuenta",
      status: skipDetails.length > 0 ? "partial" : "success",
      rowsSynced,
      rowsSkipped: skipDetails.length,
      skipDetails,
      excludedNetZero,
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

export async function syncCostoDiario(mes: string): Promise<SyncResult> {
  const startedAt = nowIso();
  const skipDetails: SkipDetail[] = [];

  try {
    const client = createSwitchClient();
    const db = getSupabaseServer();

    const data = await client.get<unknown>("/apireporte/totalventas", { tipo: "03", mes });
    const raw: RawRow[] = Array.isArray(data) ? (data as RawRow[]) : [];
    const rows: RawRow[] = [];

    for (const r of raw) {
      const fecha = asStr(firstKey(r, ["fecha", "dia"]));
      const costoRaw = firstKey(r, ["costo", "costoTotal", "total", "monto"]);
      const costo = parseMontoStrict(costoRaw);
      if (!fecha || costo == null) {
        skipDetails.push({
          entidad: "costo_diario",
          identificador: fecha ?? "(sin fecha)",
          campo: "fecha/costo_total",
          valorCrudo: JSON.stringify({ fecha, costo: costoRaw }),
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
