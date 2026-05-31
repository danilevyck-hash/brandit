// GET /api/cxc/frescura → { data_al, synced_at } desde switch_estadocuenta.
// data_al = última fecha de documento (fecha_emision); synced_at = sync más reciente.
import { NextRequest, NextResponse } from "next/server";
import { requireRoles } from "@/lib/auth-brandit";
import { getSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = requireRoles(req, ["admin"]);
  if (auth instanceof NextResponse) return auth;

  const db = getSupabaseServer();
  const [{ data: fechaRow }, { data: syncRow }] = await Promise.all([
    db.from("switch_estadocuenta").select("fecha_emision").order("fecha_emision", { ascending: false, nullsFirst: false }).limit(1),
    db.from("switch_estadocuenta").select("synced_at").order("synced_at", { ascending: false }).limit(1),
  ]);

  return NextResponse.json({
    data_al: fechaRow?.[0]?.fecha_emision ?? null,
    synced_at: syncRow?.[0]?.synced_at ?? null,
  });
}
