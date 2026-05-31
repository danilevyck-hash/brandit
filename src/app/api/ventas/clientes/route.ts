// GET /api/ventas/clientes?fecha_inicio&fecha_fin&limit → RPC ventas_clientes_v1
// Clientes recurrentes (>=2 tickets, excluye CONTADO/CONSUMIDOR FINAL), un solo stream.
import { NextRequest, NextResponse } from "next/server";
import { requireRoles } from "@/lib/auth-brandit";
import { getSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  const auth = requireRoles(req, ["admin"]);
  if (auth instanceof NextResponse) return auth;

  const sp = req.nextUrl.searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const ene1 = `${new Date().getFullYear()}-01-01`;
  const fecha_inicio = sp.get("fecha_inicio") ?? ene1;
  const fecha_fin = sp.get("fecha_fin") ?? today;
  const limit = sp.get("limit") ? parseInt(sp.get("limit")!, 10) : 50;

  if (!ISO_DATE.test(fecha_inicio) || !ISO_DATE.test(fecha_fin)) {
    return NextResponse.json({ error: "fecha_inicio / fecha_fin deben ser YYYY-MM-DD" }, { status: 400 });
  }
  if (fecha_inicio > fecha_fin) {
    return NextResponse.json({ error: "fecha_inicio > fecha_fin" }, { status: 400 });
  }
  if (!Number.isFinite(limit) || limit < 1 || limit > 500) {
    return NextResponse.json({ error: "limit inválido (1..500)" }, { status: 400 });
  }

  const { data, error } = await getSupabaseServer().rpc("ventas_clientes_v1", {
    p_fecha_inicio: fecha_inicio,
    p_fecha_fin: fecha_fin,
    p_limit: limit,
  });
  if (error) {
    console.error("[api/ventas/clientes] rpc error", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
