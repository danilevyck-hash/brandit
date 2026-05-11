import { getSupabaseServer } from "@/lib/supabase-server";
import { logActivity } from "@/lib/activity-log";
import { NextRequest, NextResponse } from "next/server";
import { signSession, ALL_ROLES, type Role } from "@/lib/auth-brandit";

export const dynamic = "force-dynamic";

const SESSION_MAX_AGE_S = 60 * 60 * 24 * 30; // 30 días

export async function POST(req: NextRequest) {
  const { password } = await req.json();

  if (!password || typeof password !== "string") {
    return NextResponse.json({ error: "Contraseña requerida" }, { status: 400 });
  }

  const { data: users, error } = await getSupabaseServer()
    .from("user_roles")
    .select("id, email, role, nombre, empresa")
    .eq("password", password)
    .eq("activo", true)
    .limit(1);

  const data = users?.[0] ?? null;

  if (error || !data) {
    return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 401 });
  }

  if (!process.env.AUTH_SECRET) {
    return NextResponse.json({ error: "Config error: AUTH_SECRET" }, { status: 500 });
  }

  // Validar role contra whitelist conocida — proteger contra valores raros en DB
  if (!ALL_ROLES.includes(data.role as Role)) {
    return NextResponse.json({ error: `Role no reconocido: ${data.role}` }, { status: 500 });
  }

  logActivity(data.nombre || data.email, "LOGIN", "Inicio de sesión");

  // Cookie firmado con payload {role, userId, exp} — reemplaza el hash
  // estático "brandit-valid" anterior. Sesiones con cookie viejo quedan
  // inválidas → los 4 usuarios deben loguearse de nuevo una vez tras deploy.
  const token = signSession({
    role: data.role as Role,
    userId: String(data.id),
    nombre: data.nombre,
    exp: Date.now() + SESSION_MAX_AGE_S * 1000,
  });

  const isProd = process.env.NODE_ENV === "production";
  const response = NextResponse.json({
    role: data.role,
    nombre: data.nombre,
    email: data.email,
    empresa: data.empresa,
  });

  response.cookies.set("brandit_session", token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_S,
  });

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set("brandit_session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
