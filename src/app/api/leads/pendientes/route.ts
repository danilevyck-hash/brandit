import { getSupabaseServer } from "@/lib/supabase-server";
import { NextResponse, NextRequest } from "next/server";
import { requireRoles } from "@/lib/auth-brandit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = requireRoles(req, ["admin", "secretaria", "vendedora1", "vendedora2"]);
  if (auth instanceof NextResponse) return auth;

  const today = new Date().toISOString().split("T")[0];

  const { count, error } = await getSupabaseServer()
    .from("leads")
    .select("*", { count: "exact", head: true })
    .lte("fecha_seguimiento", today)
    .eq("estado", "prospecto")
    .eq("estado_venta", "activo");

  if (error) return NextResponse.json({ count: 0 });
  return NextResponse.json({ count: count || 0 });
}
