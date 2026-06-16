import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { logActivity } from "@/lib/activity-log";
import { requireRoles, getSessionPayload, type Role } from "@/lib/auth-brandit";

const PEDIDOS_ROLES: readonly Role[] = ["admin", "secretaria", "vendedora"];

export const dynamic = "force-dynamic";

// Borrado físico — abierto a los tres roles. No toca los pedidos que ya tengan
// asignado ese nombre (trabajador es texto libre, no FK).
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireRoles(req, PEDIDOS_ROLES);
  if (auth instanceof NextResponse) return auth;
  const session = getSessionPayload(req);

  const { data: existing } = await getSupabaseServer()
    .from("pedidos_equipo")
    .select("id, nombre")
    .eq("id", params.id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Trabajador no encontrado" }, { status: 404 });

  const { error } = await getSupabaseServer()
    .from("pedidos_equipo")
    .delete()
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: "Error al eliminar el trabajador" }, { status: 500 });

  await logActivity(session?.nombre || "sistema", "pedido_equipo_delete", existing.nombre);

  return NextResponse.json({ ok: true });
}
