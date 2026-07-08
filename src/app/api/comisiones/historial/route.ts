// Historial de cierres de comisiones (cabeceras de comisiones_snapshot). Solo admin.
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { requireRoles } from "@/lib/auth-brandit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = requireRoles(req, ["admin"]);
  if (auth instanceof NextResponse) return auth;

  const { data, error } = await getSupabaseServer()
    .from("comisiones_snapshot")
    .select("id,anio,mes,total_cobrado,total_comision,generado_por,generado_at")
    .order("anio", { ascending: false })
    .order("mes", { ascending: false });

  if (error) {
    console.error("[comisiones historial]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
  return NextResponse.json(data ?? []);
}
