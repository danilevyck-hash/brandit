import { getSupabaseAF } from "@/lib/supabase-af";
import { logActivity } from "@/lib/activity-log";
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { password } = await req.json();

  if (!password || typeof password !== "string") {
    return NextResponse.json({ error: "Contraseña requerida" }, { status: 400 });
  }

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

  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Config error: AUTH_SECRET" }, { status: 500 });
  }

  const token = createHash("sha256")
    .update(secret + "brandit-valid")
    .digest("hex");

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
    maxAge: 60 * 60 * 24 * 30, // 30 days
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
