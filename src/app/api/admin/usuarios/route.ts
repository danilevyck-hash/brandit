import { getSupabaseServer } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { requireRoles } from "@/lib/auth-brandit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = requireRoles(req, ["admin"]);
  if (auth instanceof NextResponse) return auth;

  // SEC-2: NO devolver el campo password al cliente (select explícito).
  const { data, error } = await getSupabaseServer()
    .from("user_roles")
    .select("id, email, role, nombre, empresa, activo")
    .order("nombre");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const auth = requireRoles(request, ["admin"]);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();

  const { data, error } = await getSupabaseServer()
    .from("user_roles")
    .insert([{
      email: body.email,
      role: body.role,
      nombre: body.nombre,
      password: body.password,
      empresa: body.empresa,
      activo: body.activo ?? true,
    }])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
