// Detalle (GET) y eliminación (DELETE) de un cierre de comisiones. Solo admin.
// DELETE borra la cabecera; el detalle cae por ON DELETE CASCADE.
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { logActivity } from "@/lib/activity-log";
import { requireRoles, getSessionPayload } from "@/lib/auth-brandit";

export const dynamic = "force-dynamic";

function parseId(idRaw: string): number | null {
  const id = parseInt(idRaw, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireRoles(req, ["admin"]);
  if (auth instanceof NextResponse) return auth;

  const id = parseId(params.id);
  if (id == null) return NextResponse.json({ error: "id inválido" }, { status: 400 });

  const db = getSupabaseServer();
  const { data: cab, error: cabErr } = await db
    .from("comisiones_snapshot")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (cabErr) { console.error(cabErr); return NextResponse.json({ error: "Error interno" }, { status: 500 }); }
  if (!cab) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const { data: det, error: detErr } = await db
    .from("comisiones_snapshot_recibos")
    .select("fecha,cliente_codigo,cliente_nombre,vendedor_nombre,total,tasa,comision")
    .eq("snapshot_id", id)
    .order("fecha", { ascending: true })
    .range(0, 99999);
  if (detErr) { console.error(detErr); return NextResponse.json({ error: "Error interno" }, { status: 500 }); }

  return NextResponse.json({ cabecera: cab, recibos: det ?? [] });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireRoles(req, ["admin"]);
  if (auth instanceof NextResponse) return auth;
  const session = getSessionPayload(req);

  const id = parseId(params.id);
  if (id == null) return NextResponse.json({ error: "id inválido" }, { status: 400 });

  const db = getSupabaseServer();
  const { data: cab } = await db.from("comisiones_snapshot").select("anio,mes").eq("id", id).maybeSingle();

  const { error } = await db.from("comisiones_snapshot").delete().eq("id", id);
  if (error) { console.error(error); return NextResponse.json({ error: "Error interno" }, { status: 500 }); }

  const etiqueta = cab ? `${cab.anio}-${String(cab.mes).padStart(2, "0")}` : String(id);
  await logActivity(session?.nombre || "admin", "comisiones_eliminar", etiqueta);

  return NextResponse.json({ ok: true });
}
