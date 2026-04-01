import { getSupabaseAF } from "@/lib/supabase-af";
import { logActivity } from "@/lib/activity-log";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { password } = await req.json();

  const { data, error } = await getSupabaseAF()
    .from("user_roles")
    .select("id, email, role, nombre, empresa")
    .eq("password", password)
    .eq("activo", true)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 401 });
  }

  logActivity(data.nombre || data.email, "LOGIN", "Inicio de sesión");

  const response = NextResponse.json({
    role: data.role,
    nombre: data.nombre,
    email: data.email,
    empresa: data.empresa,
  });
  response.cookies.set("brandit_session", data.role, {
    httpOnly: false,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
