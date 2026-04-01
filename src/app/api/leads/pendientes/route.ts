import { getSupabaseAF } from "@/lib/supabase-af";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const today = new Date().toISOString().split("T")[0];

  const { count, error } = await getSupabaseAF()
    .from("leads")
    .select("*", { count: "exact", head: true })
    .lte("fecha_seguimiento", today)
    .eq("estado", "prospecto")
    .eq("estado_venta", "activo");

  if (error) return NextResponse.json({ count: 0 });
  return NextResponse.json({ count: count || 0 });
}
