import { getSupabaseServer } from "@/lib/supabase-server";
import { logActivity } from "@/lib/activity-log";
import { NextRequest, NextResponse } from "next/server";
import { requireRoles } from "@/lib/auth-brandit";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireRoles(request, ["admin", "secretaria", "vendedora1", "vendedora2"]);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();

  const { data, error } = await getSupabaseServer()
    .from("leads")
    .update(body)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (body.estado_venta === "convertido" && data) {
    logActivity("Sistema", "LEAD_CONVERTED", data.nombre);
  }

  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireRoles(request, ["admin", "secretaria", "vendedora1", "vendedora2"]);
  if (auth instanceof NextResponse) return auth;

  const { error } = await getSupabaseServer().from("leads").delete().eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
