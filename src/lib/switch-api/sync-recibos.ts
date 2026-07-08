// Sync de RECIBOS (cobros) → switch_recibos. Boston, single-empresa.
//
// Fuente: GET /apireporte/recibos (API JSON, mismo token que facturas). Un row
// por recibo. Campos crudos confirmados en vivo (2026-07-08) contra Boston:
//   fechaCreacion "YYYY-MM-DD HH:mm:ss", clienteId/Codigo/Nombre, vendedorId/
//   vendedor/codigoVendedor, sucursalId/codigoSucursal, total.
// El endpoint NO da id/secuencial de recibo → estrategia delete+insert por MES
// calendario (los recibos de un mes cerrado no cambian; re-sincronizar reemplaza
// limpio). Boston devuelve paginacion.total = 0 → NO confiar en total: paginar
// hasta página vacía (lo hace client.getPaginated).
//
// es_retencion: Switch genera, tras facturar a clientes con retención, un recibo
// por ~50% del ITBMS de la factura. Heurística determinista (misma que fashiongr,
// calculada UNA vez acá): un recibo es retención si su total ≈ impuesto/2 de
// alguna factura del mismo cliente dentro de ±35 días. Se persiste en el insert.
//
// Uso futuro: comisión sobre cobro (tramos fijos por recibo, ver nota al pie).
// Tolerante a fallos: registra cada corrida en switch_sync_log (sync_type 'recibos').

import { getSupabaseServer } from "@/lib/supabase-server";
import { createSwitchClient, parseMonto } from "./client";
import type { SkipDetail, SyncResult } from "./types";

type RawRow = Record<string, unknown>;

export interface Mes {
  year: number;
  month: number;
}

function nowIso(): string {
  return new Date().toISOString();
}

// ─── Selección de meses (para el cron) ───────────────────────────────────────

export function mesActual(): Mes {
  const d = new Date();
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

/**
 * Cron diario: mes en curso. Los días 1-5 del mes incluye TAMBIÉN el mes anterior
 * (cierra el gap del último día del mes: un recibo del día 30/31 que se sincronizó
 * antes del cierre real se re-baja limpio en los primeros días del mes siguiente).
 */
export function mesesCronDiario(): Mes[] {
  const d = new Date();
  const cur: Mes = { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
  const meses: Mes[] = [cur];
  if (d.getUTCDate() <= 5) {
    const py = cur.month === 1 ? cur.year - 1 : cur.year;
    const pm = cur.month === 1 ? 12 : cur.month - 1;
    meses.push({ year: py, month: pm });
  }
  return meses;
}

/** Todos los meses de un año hasta upToMonth inclusive (backfill). */
export function mesesDeAnio(year: number, upToMonth: number): Mes[] {
  const meses: Mes[] = [];
  for (let m = 1; m <= upToMonth; m++) meses.push({ year, month: m });
  return meses;
}

// ─── Bounds de mes ────────────────────────────────────────────────────────────

function monthBounds(year: number, month: number): { inicio: string; hasta: string; finExcl: string } {
  const inicio = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const hasta = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const ny = month === 12 ? year + 1 : year;
  const nm = month === 12 ? 1 : month + 1;
  const finExcl = `${ny}-${String(nm).padStart(2, "0")}-01`;
  return { inicio, hasta, finExcl };
}

// ─── Retención de ITBMS ────────────────────────────────────────────────────────

const RET_WINDOW_MS = 35 * 864e5; // ±35 días

/** cliente (String(clienteId)) → facturas [{fecha, imp}] del rango, para la heurística. */
type ImpuestoMap = Map<string, { fecha: string; imp: number }[]>;

/**
 * Carga el impuesto (ITBMS) de las facturas del rango desde switch_facturas.
 * Join key = cliente_codigo (que en switch_facturas = String(clienteId), numérico),
 * igual que el cliente_switch_id que persistimos en switch_recibos.
 */
async function loadImpuestoMap(from: string, to: string): Promise<ImpuestoMap> {
  const map: ImpuestoMap = new Map();
  const db = getSupabaseServer();
  const { data, error } = await db
    .from("switch_facturas")
    .select("cliente_codigo,fecha,itbms")
    .eq("tipo_comprobante", "Factura")
    .gte("fecha", from)
    .lte("fecha", to)
    .range(0, 99999);
  if (error) {
    console.error(`[sync-recibos] loadImpuestoMap: ${error.message}`);
    return map;
  }
  for (const f of (data ?? []) as { cliente_codigo: string | null; fecha: string; itbms: unknown }[]) {
    const k = f.cliente_codigo;
    if (k == null || k === "") continue;
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push({ fecha: String(f.fecha).slice(0, 10), imp: parseMonto(f.itbms as string) });
  }
  return map;
}

/** Retención = total ≈ impuesto/2 de una factura del mismo cliente, dentro de ±35d. */
function esRetencion(cliKey: string | null, fecha: string | null, total: number, map: ImpuestoMap): boolean {
  if (!cliKey || !fecha) return false;
  const list = map.get(cliKey);
  if (!list) return false;
  const rf = Date.parse(fecha);
  return list.some((f) => {
    const ff = Date.parse(f.fecha);
    return Math.abs(rf - ff) <= RET_WINDOW_MS && Math.abs(total - f.imp / 2) <= 0.01;
  });
}

// ─── Mapeo de un recibo crudo → fila de switch_recibos ──────────────────────────

function idToInt(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
}

function mapRow(r: RawRow, impuestoMap: ImpuestoMap): RawRow {
  const fc = String(r.fechaCreacion ?? "");
  const fecha = fc.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null; // "YYYY-MM-DD HH:mm:ss" → día
  const cliId = idToInt(r.clienteId);
  const total = parseMonto(r.total as string); // defensivo (coma de miles / número)
  return {
    fecha,
    fecha_creacion: fc ? fc.replace(" ", "T") : null,
    cliente_switch_id: cliId,
    cliente_codigo: (r.clienteCodigo as string) ?? null,
    cliente_nombre: (r.clienteNombre as string) ?? null,
    vendedor_id: idToInt(r.vendedorId),
    vendedor_nombre: (r.vendedor as string) ?? null,
    vendedor_codigo: (r.codigoVendedor as string) ?? null,
    sucursal_id: idToInt(r.sucursalId),
    sucursal_codigo: (r.codigoSucursal as string) ?? null,
    total,
    es_retencion: esRetencion(cliId != null ? String(cliId) : null, fecha, total, impuestoMap),
    synced_at: nowIso(),
    raw_data: r,
  };
}

// ─── Log de auditoría ───────────────────────────────────────────────────────────

async function logSync(r: SyncResult): Promise<void> {
  try {
    await getSupabaseServer().from("switch_sync_log").insert({
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
    console.error("[sync-recibos] no se pudo escribir switch_sync_log:", e);
  }
}

// ─── Sync ─────────────────────────────────────────────────────────────────────

/** Trae todos los recibos de un mes (paginación hasta página vacía; ignora total). */
async function fetchRecibosMes(year: number, month: number): Promise<RawRow[]> {
  const client = createSwitchClient();
  const { inicio, hasta } = monthBounds(year, month);
  // getPaginated NO confía en paginacion.total cuando es 0 → pagina hasta vacío.
  return client.getPaginated<RawRow>("/apireporte/recibos", { desde: inicio, hasta }, 50);
}

/**
 * Sincroniza los meses dados. delete+insert por mes calendario. Devuelve un
 * SyncResult agregado y escribe una fila en switch_sync_log.
 */
export async function syncRecibos(meses: Mes[]): Promise<SyncResult> {
  const startedAt = nowIso();
  const skipDetails: SkipDetail[] = [];
  let rowsSynced = 0;

  try {
    if (meses.length === 0) {
      const empty: SyncResult = {
        syncType: "recibos", status: "success", rowsSynced: 0, rowsSkipped: 0,
        skipDetails: [], startedAt, finishedAt: nowIso(),
      };
      await logSync(empty);
      return empty;
    }

    const db = getSupabaseServer();

    // Mapa de impuestos para clasificar retenciones: cubre los meses + 35 días
    // antes del primero (una factura puede preceder a su recibo de retención).
    const sorted = [...meses].sort((a, b) => a.year * 12 + a.month - (b.year * 12 + b.month));
    const f0 = sorted[0];
    const lN = sorted[sorted.length - 1];
    const winFrom = new Date(Date.UTC(f0.year, f0.month - 1, 1) - RET_WINDOW_MS).toISOString().slice(0, 10);
    const winTo = monthBounds(lN.year, lN.month).finExcl;
    const impuestoMap = await loadImpuestoMap(winFrom, winTo);

    for (const { year, month } of meses) {
      const raw = await fetchRecibosMes(year, month);
      const rows: RawRow[] = [];
      for (const r of raw) {
        const mapped = mapRow(r, impuestoMap);
        // fecha es NOT NULL en la tabla: si no parsea, se salta (nunca en silencio).
        if (mapped.fecha == null) {
          skipDetails.push({
            entidad: "recibos",
            identificador: String(r.clienteNombre ?? r.clienteCodigo ?? "(sin cliente)"),
            campo: "fechaCreacion",
            valorCrudo: String(r.fechaCreacion ?? ""),
            motivo: "fecha no parseable",
          });
          continue;
        }
        rows.push(mapped);
      }

      const { inicio, finExcl } = monthBounds(year, month);
      // delete+insert por mes (el endpoint no da id de recibo → reemplazo limpio).
      const { error: delErr } = await db
        .from("switch_recibos")
        .delete()
        .gte("fecha", inicio)
        .lt("fecha", finExcl);
      if (delErr) throw new Error(`delete switch_recibos: ${delErr.message}`);

      if (rows.length > 0) {
        const { error: insErr } = await db.from("switch_recibos").insert(rows);
        if (insErr) throw new Error(`insert switch_recibos: ${insErr.message}`);
        rowsSynced += rows.length;
      }
    }

    const result: SyncResult = {
      syncType: "recibos",
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
    const result: SyncResult = {
      syncType: "recibos",
      status: "error",
      rowsSynced,
      rowsSkipped: skipDetails.length,
      skipDetails,
      errorMessage: err instanceof Error ? err.message : String(err),
      startedAt,
      finishedAt: nowIso(),
    };
    await logSync(result);
    return result;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTA (comisión — para después, NO implementar aún):
//   La comisión sobre cobro usa TRAMOS FIJOS por recibo, no configurables:
//     total < $15,000  → 0.5%
//     total ≥ $15,000  → 1.0%
//   NO crear tabla de tasas.
// ─────────────────────────────────────────────────────────────────────────────
