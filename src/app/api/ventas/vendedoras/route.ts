// GET /api/ventas/vendedoras?year&periodo&mes&trimestre → RPC ventas_vendedoras_v1
import { NextRequest, NextResponse } from "next/server";
import { requireRoles } from "@/lib/auth-brandit";
import { getSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

function parseIntParam(v: string | null): number | null {
  if (v == null || v === "") return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

export async function GET(req: NextRequest) {
  const auth = requireRoles(req, ["admin"]);
  if (auth instanceof NextResponse) return auth;

  const sp = req.nextUrl.searchParams;
  const year = parseIntParam(sp.get("year")) ?? new Date().getFullYear();
  const periodo = (sp.get("periodo") ?? "mes") as "mes" | "trimestre" | "ytd";
  if (!["mes", "trimestre", "ytd"].includes(periodo)) {
    return NextResponse.json({ error: "periodo inválido (mes|trimestre|ytd)" }, { status: 400 });
  }
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "year inválido" }, { status: 400 });
  }
  const mes = parseIntParam(sp.get("mes"));
  const trimestre = parseIntParam(sp.get("trimestre"));
  if (periodo === "mes" && (mes == null || mes < 1 || mes > 12)) {
    return NextResponse.json({ error: "mes requerido (1..12) cuando periodo=mes" }, { status: 400 });
  }
  if (periodo === "trimestre" && (trimestre == null || trimestre < 1 || trimestre > 4)) {
    return NextResponse.json({ error: "trimestre requerido (1..4) cuando periodo=trimestre" }, { status: 400 });
  }

  const { data, error } = await getSupabaseServer().rpc("ventas_vendedoras_v1", {
    p_year: year,
    p_periodo: periodo,
    p_mes: periodo === "mes" ? mes : null,
    p_trimestre: periodo === "trimestre" ? trimestre : null,
  });
  if (error) {
    console.error("[api/ventas/vendedoras] rpc error", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
