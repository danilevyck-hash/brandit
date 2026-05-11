// Refetch endpoint para el tab Clientes de /ventas — siempre Boston.
// El query param `empresa` se ignora (single-empresa) — el filtro hardcoded
// vive en fetchClientes via COMPANY_KEY.

import { NextRequest, NextResponse } from "next/server";
import { requireRoles } from "@/lib/auth-brandit";
import { fetchClientes } from "@/lib/ventas/queries";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = requireRoles(req, ["admin"]);
  if (auth instanceof NextResponse) return auth;

  const yearParam = req.nextUrl.searchParams.get("year");
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "year inválido" }, { status: 400 });
  }

  try {
    const clientes = await fetchClientes({ year });
    return NextResponse.json(clientes);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "error inesperado";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
