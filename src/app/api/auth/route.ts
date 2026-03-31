import { NextRequest, NextResponse } from "next/server";

const CREDENTIALS: { env: string; role: string; nombre: string; email: string }[] = [
  { env: "ADMIN_PASSWORD", role: "admin", nombre: "David", email: "admin@brandit" },
  { env: "SECRETARIA_PASSWORD", role: "secretaria", nombre: "Secretaria", email: "secretaria@brandit" },
  { env: "VENDEDORA1_PASSWORD", role: "vendedora", nombre: "Vendedora 1", email: "vendedora1@brandit" },
  { env: "VENDEDORA2_PASSWORD", role: "vendedora", nombre: "Vendedora 2", email: "vendedora2@brandit" },
];

export async function POST(request: NextRequest) {
  const { password } = await request.json();

  if (!password) {
    return NextResponse.json({ error: "Contraseña requerida" }, { status: 400 });
  }

  // DEBUG TEMPORAL — eliminar después de verificar
  const preview = (s: string | undefined) => s ? s.substring(0, 3) + "..." : "UNDEFINED";
  console.log("[AUTH DEBUG] password recibida:", preview(password));
  for (const c of CREDENTIALS) {
    console.log(`[AUTH DEBUG] ${c.env}:`, preview(process.env[c.env]));
  }

  for (const cred of CREDENTIALS) {
    const envPassword = process.env[cred.env];
    if (envPassword && password === envPassword) {
      const response = NextResponse.json({
        role: cred.role,
        nombre: cred.nombre,
        email: cred.email,
      });

      response.cookies.set("brandit_session", cred.role, {
        path: "/",
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });

      return response;
    }
  }

  return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 401 });
}
