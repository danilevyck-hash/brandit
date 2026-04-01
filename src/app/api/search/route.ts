import { getSupabaseAF } from "@/lib/supabase-af";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json({ leads: [], cxc: [] });

  const db = getSupabaseAF();

  const [leadsRes, cxcRes] = await Promise.all([
    db
      .from("leads")
      .select("id, nombre, empresa, estado, estado_venta")
      .or(`nombre.ilike.%${q}%,empresa.ilike.%${q}%`)
      .limit(5),
    db
      .from("cxc_rows")
      .select("id, nombre, total, d_91_120, d_121_180, d_181_270, d_271_365, d_mas_365")
      .ilike("nombre", `%${q}%`)
      .limit(5),
  ]);

  return NextResponse.json({
    leads: leadsRes.data || [],
    cxc: cxcRes.data || [],
  });
}
