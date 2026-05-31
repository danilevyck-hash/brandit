// GET /api/ventas/detalle-mensual?year&mes → RPC ventas_detalle_mensual_v1
import { NextRequest, NextResponse } from "next/server";
import { requireRoles } from "@/lib/auth-brandit";
import { getSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = requireRoles(req, ["admin"]);
  if (auth instanceof NextResponse) return auth;

  const sp = req.nextUrl.searchParams;
  const now = new Date();
  const year = sp.get("year") ? parseInt(sp.get("year")!, 10) : now.getFullYear();
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "year inválido" }, { status: 400 });
  }
  const mesFallback = year === now.getFullYear() ? now.getMonth() + 1 : 12;
  const mes = sp.get("mes") ? parseInt(sp.get("mes")!, 10) : mesFallback;
  if (!Number.isFinite(mes) || mes < 1 || mes > 12) {
    return NextResponse.json({ error: "mes inválido (1..12)" }, { status: 400 });
  }

  const { data, error } = await getSupabaseServer().rpc("ventas_detalle_mensual_v1", { p_year: year, p_mes: mes });
  if (error) {
    console.error("[api/ventas/detalle-mensual] rpc error", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
