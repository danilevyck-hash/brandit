import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { logActivity } from "@/lib/activity-log";
import { requireRoles, getSessionPayload, type Role } from "@/lib/auth-brandit";

const PEDIDOS_ROLES: readonly Role[] = ["admin", "secretaria", "vendedora"];

const TIPOS_VALIDOS = ["DTF", "UV DTF", "Sublimación", "Bordado", "Grabado láser", "Gran formato", "Confección"];
const ESTADOS_VALIDOS = ["Pendiente", "En proceso", "Listo"];

export const dynamic = "force-dynamic";

const ALLOWED_FIELDS = ["cliente", "tipo", "trabajador", "estado", "fecha_entrega", "notas"];

function pick(body: Record<string, unknown>, fields: string[]) {
  const result: Record<string, unknown> = {};
  for (const f of fields) { if (f in body) result[f] = body[f]; }
  return result;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireRoles(req, PEDIDOS_ROLES);
  if (auth instanceof NextResponse) return auth;
  const session = getSessionPayload(req);
  if (!session?.userId) return NextResponse.json({ error: "Sesión inválida" }, { status: 401 });

  const body = await req.json();

  const { data: existing } = await getSupabaseServer()
    .from("pedidos_produccion")
    .select("id, cliente, estado")
    .eq("id", params.id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });

  // ── Ciclar estado (Pendiente → En proceso → Listo → Pendiente) ──
  if (body.action === "ciclar-estado") {
    const i = ESTADOS_VALIDOS.indexOf(existing.estado);
    const next = ESTADOS_VALIDOS[(i + 1) % ESTADOS_VALIDOS.length];
    const { error } = await getSupabaseServer()
      .from("pedidos_produccion")
      .update({ estado: next })
      .eq("id", params.id);
    if (error) return NextResponse.json({ error: "Error al cambiar el estado" }, { status: 500 });
    await logActivity(session?.nombre || "sistema", "pedido_produccion_estado", `${existing.cliente} → ${next}`);
    return NextResponse.json({ ok: true, estado: next });
  }

  // ── Edición de campos (allowlist) ──
  const fields = pick(body, ALLOWED_FIELDS);

  if ("cliente" in fields) {
    const cliente = typeof fields.cliente === "string" ? fields.cliente.trim() : "";
    if (!cliente) return NextResponse.json({ error: "El cliente es obligatorio." }, { status: 400 });
    fields.cliente = cliente;
  }

  if ("tipo" in fields) {
    const tipo = typeof fields.tipo === "string" ? fields.tipo.trim() : "";
    if (!TIPOS_VALIDOS.includes(tipo)) return NextResponse.json({ error: "El tipo de personalización no es válido." }, { status: 400 });
    fields.tipo = tipo;
  }

  if ("estado" in fields) {
    const estado = typeof fields.estado === "string" ? fields.estado.trim() : "";
    if (!ESTADOS_VALIDOS.includes(estado)) return NextResponse.json({ error: "El estado no es válido." }, { status: 400 });
    fields.estado = estado;
  }

  if ("trabajador" in fields) {
    fields.trabajador = typeof fields.trabajador === "string" ? fields.trabajador.trim() || null : null;
  }

  if ("fecha_entrega" in fields) {
    const raw = fields.fecha_entrega;
    if (raw === null || raw === undefined || String(raw).trim() === "") {
      fields.fecha_entrega = null;
    } else if (typeof raw !== "string") {
      return NextResponse.json({ error: "La fecha de entrega no es válida." }, { status: 400 });
    }
  }

  if ("notas" in fields) {
    fields.notas = typeof fields.notas === "string" ? fields.notas.trim() || null : null;
  }

  if (Object.keys(fields).length === 0) return NextResponse.json({ error: "Nada que actualizar." }, { status: 400 });

  const { data, error } = await getSupabaseServer()
    .from("pedidos_produccion")
    .update(fields)
    .eq("id", params.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: "Error al actualizar el pedido" }, { status: 500 });

  await logActivity(session?.nombre || "sistema", "pedido_produccion_update", existing.cliente);

  return NextResponse.json(data);
}

// Borrado físico — abierto a los tres roles (cualquiera puede borrar).
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireRoles(req, PEDIDOS_ROLES);
  if (auth instanceof NextResponse) return auth;
  const session = getSessionPayload(req);

  const { data: existing } = await getSupabaseServer()
    .from("pedidos_produccion")
    .select("id, cliente")
    .eq("id", params.id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });

  const { error } = await getSupabaseServer()
    .from("pedidos_produccion")
    .delete()
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: "Error al eliminar el pedido" }, { status: 500 });

  await logActivity(session?.nombre || "sistema", "pedido_produccion_delete", existing.cliente);

  return NextResponse.json({ ok: true });
}
