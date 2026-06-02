import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { requireRoles, type Role } from "@/lib/auth-brandit";

const CAJA_ROLES: readonly Role[] = ["admin", "secretaria"];

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = requireRoles(req, CAJA_ROLES);
  if (auth instanceof NextResponse) return auth;
  const { data, error } = await getSupabaseServer()
    .from("caja_responsables")
    .select("*")
    .eq("activo", true)
    .order("nombre");

  if (error) { console.error(error); return NextResponse.json({ error: "Error interno" }, { status: 500 }); }
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const auth = requireRoles(req, CAJA_ROLES);
  if (auth instanceof NextResponse) return auth;
  const body = await req.json();
  const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
  if (!nombre) return NextResponse.json({ error: "El nombre es obligatorio." }, { status: 400 });

  // Evitar duplicados obvios (case-insensitive): si ya existe, devolverlo.
  const { data: existing } = await getSupabaseServer()
    .from("caja_responsables")
    .select("*")
    .ilike("nombre", nombre)
    .maybeSingle();
  if (existing) return NextResponse.json(existing);

  const { data, error } = await getSupabaseServer()
    .from("caja_responsables")
    .insert({ nombre })
    .select()
    .single();

  if (error) { console.error(error); return NextResponse.json({ error: "Error interno" }, { status: 500 }); }
  return NextResponse.json(data);
}
