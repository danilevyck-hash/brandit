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

/** Bucket de antigüedad a partir de días vencido (mismos cortes que cxc_aging). */
function bucketFromDias(dias: number): string {
  if (dias <= 30) return "0-30";
  if (dias <= 60) return "31-60";
  if (dias <= 90) return "61-90";
  if (dias <= 120) return "91-120";
  if (dias <= 180) return "121-180";
  if (dias <= 270) return "181-270";
  if (dias <= 365) return "271-365";
  return "+365";
}

async function logSync(r: SyncResult): Promise<void> {
  try {
    const db = getSupabaseServer();
    await db.from("switch_sync_log").insert({
      sync_type: r.syncType,
      started_at: r.startedAt,
      finished_at: r.finishedAt,
      status: r.status,
      rows_synced: r.rowsSynced,
      rows_skipped: r.rowsSkipped,
      skip_details: r.skipDetails,
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

// ─── Estado de cuenta (CxC, snapshot puntual) ─────────────────────────────────

export async function syncEstadocuenta(): Promise<SyncResult> {
  const startedAt = nowIso();
  const skipDetails: SkipDetail[] = [];

  try {
    const client = createSwitchClient();
    const db = getSupabaseServer();

    const raw = await client.getPaginated<RawRow>("/apicliente/estadocuenta", {}, 50);
    const rows: RawRow[] = [];

    for (const r of raw) {
      const clienteCodigo = asStr(firstKey(r, ["clienteCodigo", "codigoCliente", "cliente_codigo"]));
      const saldoRaw = firstKey(r, ["saldo", "saldoPendiente", "montoSaldo"]);
      const saldo = parseMontoStrict(saldoRaw);
      if (!clienteCodigo || saldo == null) {
        skipDetails.push({
          entidad: "estadocuenta",
          identificador: clienteCodigo ?? "(sin codigo)",
          campo: "cliente_codigo/saldo",
          valorCrudo: JSON.stringify({ clienteCodigo, saldo: saldoRaw }),
          motivo: "campo clave ausente/no parseable",
        });
        continue;
      }

      const diasRaw = firstKey(r, ["diasVencido", "dias_vencido", "dias"]);
      const diasNum = diasRaw == null ? null : Number(diasRaw);
      const diasVencido = diasNum != null && Number.isFinite(diasNum) ? diasNum : null;

      rows.push({
        cliente_codigo: clienteCodigo,
        cliente_nombre: asStr(firstKey(r, ["clienteNombre", "nombreCliente", "cliente_nombre"])),
        factura_numero: asStr(firstKey(r, ["numero", "facturaNumero", "documento"])),
        fecha_emision: asStr(firstKey(r, ["fechaEmision", "fecha"])),
        fecha_vencimiento: asStr(firstKey(r, ["fechaVencimiento", "vencimiento"])),
        dias_vencido: diasVencido,
        bucket: diasVencido == null ? null : bucketFromDias(diasVencido),
        saldo,
      });
    }

    // REPLACE all — snapshot puntual de CxC. (id es BIGSERIAL > 0.)
    const del = await db.from("switch_estadocuenta").delete().neq("id", 0);
    if (del.error) throw new Error(`delete switch_estadocuenta: ${del.error.message}`);

    if (rows.length > 0) {
      const ins = await db.from("switch_estadocuenta").insert(rows);
      if (ins.error) throw new Error(`insert switch_estadocuenta: ${ins.error.message}`);
    }

    const result: SyncResult = {
      syncType: "estadocuenta",
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
    const result = errorResult("estadocuenta", startedAt, skipDetails, 0, err);
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
