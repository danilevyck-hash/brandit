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

function mapComprobante(raw: RawRow, tipo: TipoComprobante): { row?: RawRow; skip?: SkipDetail } {
  const numero = asStr(firstKey(raw, ["numero", "numeroDocumento", "documento", "nro"]));
  const facturaId = asStr(firstKey(raw, ["id", "idFactura", "facturaId", "idDocumento"])) ?? numero;
  const fecha = asStr(firstKey(raw, ["fecha", "fechaDocumento", "fechaEmision"]));
  const ident = facturaId ?? numero ?? "(desconocido)";

  if (!facturaId || !numero || !fecha) {
    return {
      skip: {
        entidad: tipo,
        identificador: ident,
        campo: "factura_id/numero/fecha",
        valorCrudo: JSON.stringify({ facturaId, numero, fecha }),
        motivo: "campo clave ausente",
      },
    };
  }

  const subtotalDescRaw = firstKey(raw, ["subtotalDescuento", "subtotalConDescuento", "subTotalDescuento", "baseImponible"]);
  const subtotalDescuento = parseMontoStrict(subtotalDescRaw);
  if (subtotalDescuento == null) {
    return {
      skip: { entidad: tipo, identificador: ident, campo: "subtotal_descuento", valorCrudo: String(subtotalDescRaw ?? ""), motivo: "no parseable" },
    };
  }

  const totalRaw = firstKey(raw, ["total", "totalDocumento", "montoTotal"]);
  const total = parseMontoStrict(totalRaw);
  if (total == null) {
    return {
      skip: { entidad: tipo, identificador: ident, campo: "total", valorCrudo: String(totalRaw ?? ""), motivo: "no parseable" },
    };
  }

  const clienteCodigo = asStr(firstKey(raw, ["clienteCodigo", "codigoCliente", "cliente_codigo"]));
  const vendedorCodigo = asStr(firstKey(raw, ["vendedorCodigo", "codigoVendedor", "vendedor_codigo"]));

  // Heurística is_wholesale (mismo patrón que Multifashion en fashiongr):
  // cliente identificado + vendedor DEFAULT/ausente ⇒ venta al por mayor.
  // Pendiente de validar contra data real cuando haya env vars.
  const isWholesale = !!clienteCodigo && (!vendedorCodigo || vendedorCodigo.toUpperCase() === "DEFAULT");

  return {
    row: {
      factura_id: facturaId,
      numero,
      fecha,
      cliente_codigo: clienteCodigo,
      cliente_nombre: asStr(firstKey(raw, ["clienteNombre", "nombreCliente", "cliente_nombre"])),
      vendedor_codigo: vendedorCodigo,
      vendedor_nombre: asStr(firstKey(raw, ["vendedorNombre", "nombreVendedor", "vendedor_nombre"])),
      subtotal: parseMonto(firstKey(raw, ["subtotal", "subTotal"]) as string),
      subtotal_descuento: subtotalDescuento,
      itbms: parseMonto(firstKey(raw, ["itbms", "impuesto", "iva"]) as string),
      total,
      tipo_comprobante: tipo,
      is_wholesale: isWholesale,
      sucursal_codigo: asStr(firstKey(raw, ["sucursalCodigo", "codigoSucursal", "sucursal"])),
      raw_data: raw,
    },
  };
}

export async function syncFacturas(opts: { desde: string; hasta: string }): Promise<SyncResult> {
  const startedAt = nowIso();
  const skipDetails: SkipDetail[] = [];
  let rowsSynced = 0;

  try {
    const client = createSwitchClient();
    const db = getSupabaseServer();

    for (const { endpoint, tipo } of COMPROBANTE_ENDPOINTS) {
      const raw = await client.getPaginated<RawRow>(endpoint, { desde: opts.desde, hasta: opts.hasta }, 50);
      const rows: RawRow[] = [];
      for (const r of raw) {
        const mapped = mapComprobante(r, tipo);
        if (mapped.skip) {
          skipDetails.push(mapped.skip);
          continue;
        }
        if (mapped.row) rows.push(mapped.row);
      }
      if (rows.length > 0) {
        const { error } = await db
          .from("switch_facturas")
          .upsert(rows, { onConflict: "factura_id,tipo_comprobante" });
        if (error) throw new Error(`upsert switch_facturas (${tipo}): ${error.message}`);
        rowsSynced += rows.length;
      }
    }

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
