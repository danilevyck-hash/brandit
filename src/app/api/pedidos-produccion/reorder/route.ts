import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { logActivity } from "@/lib/activity-log";
import { requireRoles, getSessionPayload, type Role } from "@/lib/auth-brandit";

const PEDIDOS_ROLES: readonly Role[] = ["admin", "secretaria", "vendedora"];

export const dynamic = "force-dynamic";

/**
 * Persiste el nuevo orden de la cola general. Recibe el arreglo completo de la
 * cola en el orden deseado: { items: [{ id, orden }, ...] }. Reescribe `orden`
 * de cada fila con UPDATEs individuales (la cola del taller es chica, y un
 * upsert parcial fallaría por las columnas NOT NULL del INSERT subyacente). El
 * cliente hace el swap optimista y envía la lista entera, así no hay ambigüedad
 * de "vecino" cuando hay filtro por tipo activo.
 */
export async function POST(req: NextRequest) {
  const auth = requireRoles(req, PEDIDOS_ROLES);
  if (auth instanceof NextResponse) return auth;
  const session = getSessionPayload(req);
  if (!session?.userId) return NextResponse.json({ error: "Sesión inválida" }, { status: 401 });

  const body = await req.json();
  const items = body?.items;
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Lista de orden inválida." }, { status: 400 });
  }

  const rows: { id: string; orden: number }[] = [];
  for (const it of items) {
    const id = typeof it?.id === "string" ? it.id : "";
    const orden = Number(it?.orden);
    if (!id || isNaN(orden)) {
      return NextResponse.json({ error: "Lista de orden inválida." }, { status: 400 });
    }
    rows.push({ id, orden });
  }

  const supabase = getSupabaseServer();
  const results = await Promise.all(
    rows.map((r) =>
      supabase.from("pedidos_produccion").update({ orden: r.orden }).eq("id", r.id)
    )
  );
  const failed = results.find((res) => res.error);
  if (failed?.error) { console.error(failed.error); return NextResponse.json({ error: "Error al reordenar" }, { status: 500 }); }

  await logActivity(session?.nombre || "sistema", "pedido_produccion_reorder", `${rows.length} pedidos`);

  return NextResponse.json({ ok: true });
}
