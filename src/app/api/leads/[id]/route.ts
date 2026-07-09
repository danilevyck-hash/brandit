import { getSupabaseServer } from "@/lib/supabase-server";
import { logActivity } from "@/lib/activity-log";
import { NextRequest, NextResponse } from "next/server";
import { requireRoles } from "@/lib/auth-brandit";

// SEC-4: columnas permitidas en el update (anti mass-assignment).
const LEAD_FIELDS = [
  "nombre", "empresa", "telefono", "email", "estado", "estado_venta",
  "notas", "vendedora", "empresa_vendedora", "fecha_seguimiento", "asignado_a",
] as const;
function pickLeadFields(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of LEAD_FIELDS) if (k in body) out[k] = body[k];
  return out;
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireRoles(request, ["admin", "secretaria", "vendedora"]);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const updates = pickLeadFields(body);

  const { data, error } = await getSupabaseServer()
    .from("leads")
    .update(updates)
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
  // SEC-5: borrado destructivo solo admin/secretaria (no vendedora).
  const auth = requireRoles(request, ["admin", "secretaria"]);
  if (auth instanceof NextResponse) return auth;

  const { error } = await getSupabaseServer().from("leads").delete().eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
