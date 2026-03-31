import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { password } = await req.json();

  console.log("[AUTH DEBUG] password recibida:", password?.slice(0, 3));
  console.log("[AUTH DEBUG] ADMIN_PASSWORD:", process.env.ADMIN_PASSWORD?.slice(0, 3));
  console.log("[AUTH DEBUG] SECRETARIA_PASSWORD:", process.env.SECRETARIA_PASSWORD?.slice(0, 3));
  console.log("[AUTH DEBUG] VENDEDORA1_PASSWORD:", process.env.VENDEDORA1_PASSWORD?.slice(0, 3));
  console.log("[AUTH DEBUG] VENDEDORA2_PASSWORD:", process.env.VENDEDORA2_PASSWORD?.slice(0, 3));

  const roles: Record<string, { role: string; nombre: string; email: string }> = {
    [process.env.ADMIN_PASSWORD!]: { role: "admin", nombre: "David", email: "admin@brandit" },
    [process.env.SECRETARIA_PASSWORD!]: { role: "secretaria", nombre: "Secretaria", email: "secretaria@brandit" },
    [process.env.VENDEDORA1_PASSWORD!]: { role: "vendedora", nombre: "Vendedora 1", email: "vendedora1@brandit" },
    [process.env.VENDEDORA2_PASSWORD!]: { role: "vendedora", nombre: "Vendedora 2", email: "vendedora2@brandit" },
  };

  const match = roles[password];
  if (!match) {
    return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 401 });
  }

  const response = NextResponse.json(match);
  response.cookies.set("brandit_session", match.role, {
    httpOnly: false,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
