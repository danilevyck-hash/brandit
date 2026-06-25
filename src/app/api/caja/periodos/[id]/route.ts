import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { logActivity } from "@/lib/activity-log";
import { requireRoles, getSessionPayload, type Role } from "@/lib/auth-brandit";

const CAJA_ROLES: readonly Role[] = ["admin", "secretaria"];

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireRoles(req, CAJA_ROLES);
  if (auth instanceof NextResponse) return auth;

  const includeDeleted = req.nextUrl.searchParams.get("include_deleted") === "1";

  const { data, error } = await getSupabaseServer()
    .from("caja_periodos").select("*, caja_gastos(*)").eq("id", params.id).single();
  if (error) return NextResponse.json({ error: "Error interno" }, { status: 500 });

  if (data?.caja_gastos) {
    type RawGasto = {
      deleted?: boolean;
      fecha: string;
      created_at: string;
      deleted_at?: string | null;
      deleted_by?: string | null;
    };
    const active: RawGasto[] = [];
    const removed: RawGasto[] = [];
    for (const g of data.caja_gastos as RawGasto[]) {
      if (g.deleted) removed.push(g);
      else active.push(g);
    }
    active.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.created_at.localeCompare(b.created_at));
    data.caja_gastos = active;

    if (includeDeleted) {
      removed.sort((a, b) => (b.deleted_at || "").localeCompare(a.deleted_at || ""));

      data.deleted_gastos = removed.map((g) => ({
        ...g,
        deleted_by_name: g.deleted_by,
      }));
    }
  }
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireRoles(req, CAJA_ROLES);
  if (auth instanceof NextResponse) return auth;
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty body = close period */ }

  const session = getSessionPayload(req);

  if (body.action === "repuesto") {
    const { error } = await getSupabaseServer().from("caja_periodos").update({ repuesto: true, repuesto_at: new Date().toISOString() }).eq("id", params.id);
    if (error) return NextResponse.json({ error: "Error interno" }, { status: 500 });
    await logActivity(session?.nombre || "sistema", "caja_periodo_repuesto", `período ${params.id}`);
    return NextResponse.json({ ok: true });
  }

  // Default action: close the period. El cierre procede sin importar el saldo.
  const { data: periodo } = await getSupabaseServer()
    .from("caja_periodos")
    .select("estado, deleted")
    .eq("id", params.id)
    .maybeSingle();
  if (!periodo || periodo.deleted) return NextResponse.json({ error: "Este período ya no existe." }, { status: 404 });
  if (periodo.estado === "cerrado") return NextResponse.json({ error: "Este período ya está cerrado." }, { status: 400 });

  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await getSupabaseServer().from("caja_periodos").update({ estado: "cerrado", fecha_cierre: today }).eq("id", params.id).select().single();
  if (error) return NextResponse.json({ error: "Error interno" }, { status: 500 });
  await logActivity(session?.nombre || "sistema", "caja_periodo_close", `período ${params.id}`);
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireRoles(req, ["admin"]);
  if (auth instanceof NextResponse) return auth;
  const { data: existing } = await getSupabaseServer().from("caja_periodos").select("id, numero").eq("id", params.id).maybeSingle();
  if (!existing) return NextResponse.json({ error: "Período no encontrado" }, { status: 404 });

  const { error } = await getSupabaseServer().from("caja_periodos").update({ deleted: true }).eq("id", params.id);
  if (error) return NextResponse.json({ error: "Error interno" }, { status: 500 });

  const session = getSessionPayload(req);
  await logActivity(session?.nombre || "sistema", "caja_periodo_delete", `período N° ${existing.numero}`);
  return NextResponse.json({ ok: true });
}
