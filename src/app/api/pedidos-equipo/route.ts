import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { logActivity } from "@/lib/activity-log";
import { requireRoles, getSessionPayload, type Role } from "@/lib/auth-brandit";

const PEDIDOS_ROLES: readonly Role[] = ["admin", "secretaria", "vendedora"];

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = requireRoles(req, PEDIDOS_ROLES);
  if (auth instanceof NextResponse) return auth;

  const { data, error } = await getSupabaseServer()
    .from("pedidos_equipo")
    .select("*")
    .order("nombre", { ascending: true });

  if (error) { console.error(error); return NextResponse.json({ error: "Error interno" }, { status: 500 }); }
  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  const auth = requireRoles(req, PEDIDOS_ROLES);
  if (auth instanceof NextResponse) return auth;
  const session = getSessionPayload(req);
  if (!session?.userId) return NextResponse.json({ error: "Sesión inválida" }, { status: 401 });

  const body = await req.json();
  const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
  if (!nombre) return NextResponse.json({ error: "El nombre es obligatorio." }, { status: 400 });

  const { data, error } = await getSupabaseServer()
    .from("pedidos_equipo")
    .insert({ nombre })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "Ese trabajador ya existe." }, { status: 409 });
    console.error(error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }

  await logActivity(session?.nombre || "sistema", "pedido_equipo_create", nombre);

  return NextResponse.json(data);
}
