// Sync del maestro de clientes → switch_clientes_cartera. Boston, single-empresa.
//
// Fuente: GET /apicliente/lista (API JSON, mismo token). Cada cliente trae
// vendedorId + vendedor = el DUEÑO DE CARTERA del cliente. Se usa para atribuir
// los cobros del Formato B de comisiones (cartera, no vendedor del recibo).
//
// Boston devuelve paginacion.total = 0 en este endpoint → getPaginated pagina
// hasta página vacía. ~4,900 clientes a 200/página ≈ 25 requests.
//
// Estrategia: upsert por cliente_codigo (clientes sin codigo se saltan, quedan
// en skip_details). NO se borra lo que Switch ya no devuelve: un cliente
// eliminado en Switch conserva su última cartera conocida (mejor que perder la
// atribución de recibos históricos). Log en switch_sync_log ('clientes_cartera').

import { getSupabaseServer } from "@/lib/supabase-server";
import { createSwitchClient } from "./client";
import type { SkipDetail, SyncResult } from "./types";

type RawCliente = Record<string, unknown>;

const UPSERT_BATCH = 500;

function nowIso(): string {
  return new Date().toISOString();
}

function idToInt(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
}

export async function syncClientesCartera(): Promise<SyncResult> {
  const startedAt = nowIso();
  const skipDetails: SkipDetail[] = [];
  let rowsSynced = 0;

  try {
    const client = createSwitchClient();
    const raw = await client.getPaginated<RawCliente>("/apicliente/lista", {}, 200);

    const rows: Record<string, unknown>[] = [];
    const vistos = new Set<string>();
    for (const c of raw) {
      const codigo = c.codigo != null ? String(c.codigo).trim() : "";
      if (!codigo) {
        skipDetails.push({
          entidad: "clientes_cartera",
          identificador: String(c.nombre ?? c.id ?? "(sin nombre)"),
          campo: "codigo",
          valorCrudo: String(c.codigo ?? ""),
          motivo: "cliente sin codigo",
        });
        continue;
      }
      // El API puede repetir un codigo entre páginas; gana la primera aparición.
      if (vistos.has(codigo)) continue;
      vistos.add(codigo);
      rows.push({
        cliente_codigo: codigo,
        cliente_switch_id: idToInt(c.id),
        cliente_nombre: (c.nombre as string) ?? null,
        vendedor_id: idToInt(c.vendedorId),
        vendedor_nombre: (c.vendedor as string) ?? null,
        synced_at: startedAt,
      });
    }

    const db = getSupabaseServer();
    for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
      const chunk = rows.slice(i, i + UPSERT_BATCH);
      const { error } = await db
        .from("switch_clientes_cartera")
        .upsert(chunk, { onConflict: "cliente_codigo" });
      if (error) throw new Error(`upsert switch_clientes_cartera: ${error.message}`);
      rowsSynced += chunk.length;
    }

    const result: SyncResult = {
      syncType: "clientes_cartera",
      status: skipDetails.length > 0 ? "partial" : "success",
      rowsSynced,
      rowsSkipped: skipDetails.length,
      skipDetails,
      startedAt,
      finishedAt: nowIso(),
    };
    await logResult(result);
    return result;
  } catch (err) {
    const result: SyncResult = {
      syncType: "clientes_cartera",
      status: "error",
      rowsSynced,
      rowsSkipped: skipDetails.length,
      skipDetails,
      errorMessage: err instanceof Error ? err.message : String(err),
      startedAt,
      finishedAt: nowIso(),
    };
    await logResult(result);
    return result;
  }
}

async function logResult(r: SyncResult): Promise<void> {
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
    console.error("[sync-clientes-cartera] no se pudo escribir switch_sync_log:", e);
  }
}

/**
 * Mapa cliente_codigo → vendedor de cartera (crudo), para atribuir recibos.
 * Lo usan el sync de recibos (persistir vendedor_cartera) y el API de
 * comisiones (resolver filas históricas con vendedor_cartera NULL).
 */
export async function loadCarteraMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const db = getSupabaseServer();
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("switch_clientes_cartera")
      .select("cliente_codigo,vendedor_nombre")
      .order("cliente_codigo", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`loadCarteraMap: ${error.message}`);
    for (const r of (data ?? []) as { cliente_codigo: string; vendedor_nombre: string | null }[]) {
      if (r.vendedor_nombre != null && r.vendedor_nombre.trim() !== "") {
        map.set(r.cliente_codigo, r.vendedor_nombre);
      }
    }
    if ((data ?? []).length < PAGE) break;
  }
  return map;
}
