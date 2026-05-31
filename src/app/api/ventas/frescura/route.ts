// GET /api/ventas/frescura → { data_al, synced_at } desde switch_facturas.
// data_al = última fecha con ventas; synced_at = sync más reciente.
import { NextRequest, NextResponse } from "next/server";
import { requireRoles } from "@/lib/auth-brandit";
import { getSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = requireRoles(req, ["admin"]);
  if (auth instanceof NextResponse) return auth;

  const db = getSupabaseServer();
  const [{ data: fechaRow }, { data: syncRow }] = await Promise.all([
    db.from("switch_facturas").select("fecha").order("fecha", { ascending: false }).limit(1),
    db.from("switch_facturas").select("synced_at").order("synced_at", { ascending: false }).limit(1),
  ]);

  return NextResponse.json({
    data_al: fechaRow?.[0]?.fecha ?? null,
    synced_at: syncRow?.[0]?.synced_at ?? null,
  });
}
