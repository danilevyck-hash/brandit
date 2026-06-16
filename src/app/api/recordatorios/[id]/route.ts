import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { logActivity } from "@/lib/activity-log";
import { requireRoles, getSessionPayload, type Role } from "@/lib/auth-brandit";

const RECORD_ROLES: readonly Role[] = ["admin", "secretaria"];

export const dynamic = "force-dynamic";

const ALLOWED_FIELDS = ["cliente", "monto", "fecha_prometida", "nota"];

function pick(body: Record<string, unknown>, fields: string[]) {
  const result: Record<string, unknown> = {};
  for (const f of fields) { if (f in body) result[f] = body[f]; }
  return result;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireRoles(req, RECORD_ROLES);
  if (auth instanceof NextResponse) return auth;
  const session = getSessionPayload(req);
  if (!session?.userId) return NextResponse.json({ error: "Sesión inválida" }, { status: 401 });

  const body = await req.json();

  const { data: existing } = await getSupabaseServer()
    .from("recordatorios_pago")
    .select("id, cliente, cumplido")
    .eq("id", params.id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Recordatorio no encontrado" }, { status: 404 });

  // ── Marcar cumplido ──
  if (body.action === "cumplir") {
    if (existing.cumplido) return NextResponse.json({ error: "Este recordatorio ya está cumplido." }, { status: 400 });
    const { error } = await getSupabaseServer()
      .from("recordatorios_pago")
      .update({ cumplido: true, cumplido_by: session?.nombre ?? session?.userId ?? null, cumplido_at: new Date().toISOString() })
      .eq("id", params.id);
    if (error) return NextResponse.json({ error: "Error al marcar cumplido" }, { status: 500 });
    await logActivity(session?.nombre || "sistema", "recordatorio_cumplir", existing.cliente);
    return NextResponse.json({ ok: true });
  }

  // ── Restaurar (deshacer cumplido) ──
  if (body.action === "restore") {
    if (!existing.cumplido) return NextResponse.json({ error: "Este recordatorio no está cumplido." }, { status: 400 });
    const { error } = await getSupabaseServer()
      .from("recordatorios_pago")
      .update({ cumplido: false, cumplido_by: null, cumplido_at: null })
      .eq("id", params.id);
    if (error) return NextResponse.json({ error: "Error al restaurar" }, { status: 500 });
    await logActivity(session?.nombre || "sistema", "recordatorio_restore", existing.cliente);
    return NextResponse.json({ ok: true });
  }

  // ── Edición de campos (allowlist) ──
  const fields = pick(body, ALLOWED_FIELDS);

  if ("cliente" in fields) {
    const cliente = typeof fields.cliente === "string" ? fields.cliente.trim() : "";
    if (!cliente) return NextResponse.json({ error: "El cliente es obligatorio." }, { status: 400 });
    fields.cliente = cliente;
  }

  if ("fecha_prometida" in fields) {
    const fecha = fields.fecha_prometida;
    if (!fecha || typeof fecha !== "string") return NextResponse.json({ error: "La fecha prometida es obligatoria." }, { status: 400 });
  }

  if ("monto" in fields) {
    const raw = fields.monto;
    if (raw === null || raw === undefined || String(raw).trim() === "") {
      fields.monto = null;
    } else {
      const n = Number(raw);
      if (isNaN(n) || n < 0) return NextResponse.json({ error: "El monto no es válido." }, { status: 400 });
      fields.monto = Math.round(n * 100) / 100;
    }
  }

  if ("nota" in fields) {
    fields.nota = typeof fields.nota === "string" ? fields.nota.trim() || null : null;
  }

  if (Object.keys(fields).length === 0) return NextResponse.json({ error: "Nada que actualizar." }, { status: 400 });

  const { data, error } = await getSupabaseServer()
    .from("recordatorios_pago")
    .update(fields)
    .eq("id", params.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: "Error al actualizar recordatorio" }, { status: 500 });

  await logActivity(session?.nombre || "sistema", "recordatorio_update", existing.cliente);

  return NextResponse.json(data);
}

// Borrado físico — solo admin (para registros erróneos).
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireRoles(req, ["admin"]);
  if (auth instanceof NextResponse) return auth;
  const session = getSessionPayload(req);

  const { data: existing } = await getSupabaseServer()
    .from("recordatorios_pago")
    .select("id, cliente")
    .eq("id", params.id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Recordatorio no encontrado" }, { status: 404 });

  const { error } = await getSupabaseServer()
    .from("recordatorios_pago")
    .delete()
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: "Error al eliminar recordatorio" }, { status: 500 });

  await logActivity(session?.nombre || "sistema", "recordatorio_delete", existing.cliente);

  return NextResponse.json({ ok: true });
}
