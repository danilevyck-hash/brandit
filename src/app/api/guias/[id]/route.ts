// Detalle (GET), despacho/edición (PUT), update parcial (PATCH), soft-delete (DELETE).
// Portado del molde fashiongr. Auth Brand It. Mono-empresa (items sin empresa).
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { requireRoles } from "@/lib/auth-brandit";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROLES_GUIAS = ["admin", "secretaria", "vendedora1", "vendedora2"] as const;

type TransportistaJoin = { nombre: string | null } | { nombre: string | null }[] | null;
function transportistaLabel(row: { modo_entrega?: string | null; transportista?: string | null; transportistas?: TransportistaJoin }): string {
  if (row.modo_entrega === "entrega_directa") return "Entrega directa";
  const j = Array.isArray(row.transportistas) ? row.transportistas[0] : row.transportistas;
  return j?.nombre || row.transportista || ""; // catálogo (join) o texto libre
}

type ItemRow = { id?: string; orden: number; deleted?: boolean };
async function reFetch(db: ReturnType<typeof getSupabaseServer>, id: string) {
  const { data } = await db.from("guia_transporte").select("*, transportistas(nombre), guia_items(*)").eq("id", id).single();
  if (data) {
    (data as Record<string, unknown>).transportista = transportistaLabel(data);
    const items = (data as { guia_items?: ItemRow[] }).guia_items;
    if (items) (data as { guia_items: ItemRow[] }).guia_items = items.filter((i) => !i.deleted).sort((a, b) => a.orden - b.orden);
  }
  return data;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireRoles(req, [...ROLES_GUIAS]);
  if (auth instanceof NextResponse) return auth;
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  const data = await reFetch(getSupabaseServer(), params.id);
  if (!data) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  return NextResponse.json(data);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireRoles(req, [...ROLES_GUIAS]);
  if (auth instanceof NextResponse) return auth;
  const id = params.id;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  const db = getSupabaseServer();
  const body = await req.json();
  const { fecha, modo_entrega, transportista_id, transportista, placa, observaciones, items, monto_total, estado, receptor_nombre, cedula, firma_base64, firma_entregador_base64, entregado_por, numero_guia_transp, tipo_despacho, nombre_chofer, motivo_rechazo } = body;

  if (modo_entrega !== undefined) {
    if (modo_entrega !== "transportista" && modo_entrega !== "entrega_directa") return NextResponse.json({ error: "Modo de entrega inválido" }, { status: 400 });
    if (modo_entrega === "transportista" && !String(transportista || "").trim()) return NextResponse.json({ error: "Indica el transportista" }, { status: 400 });
  }

  // Guard de despacho: validar receptor/cédula/placa/chofer.
  if (estado === "Completada" || estado === "Despachada") {
    const { data: currentItems } = await db.from("guia_items").select("bultos").eq("guia_id", id).eq("deleted", false);
    const itemCount = items !== undefined ? (items?.length || 0) : (currentItems?.length || 0);
    const totalBultos = items !== undefined
      ? (items || []).reduce((s: number, i: { bultos?: number }) => s + (i.bultos || 0), 0)
      : (currentItems || []).reduce((s: number, i: { bultos: number }) => s + (i.bultos || 0), 0);
    if (itemCount === 0) return NextResponse.json({ error: "No se puede despachar una guía sin items" }, { status: 400 });
    if (totalBultos === 0) return NextResponse.json({ error: "No se puede despachar una guía con 0 bultos" }, { status: 400 });
    if (!receptor_nombre) return NextResponse.json({ error: "Nombre del receptor requerido" }, { status: 400 });
    if (!cedula) return NextResponse.json({ error: "Cédula del receptor requerida" }, { status: 400 });
    if (tipo_despacho === "externo" && !placa) return NextResponse.json({ error: "Placa requerida para transporte externo" }, { status: 400 });
    if (tipo_despacho === "directo" && !nombre_chofer) return NextResponse.json({ error: "Nombre del chofer requerido para entrega directa" }, { status: 400 });
  }

  const { data: previous } = await db.from("guia_transporte").select("estado").eq("id", id).single();
  if (previous?.estado === "Completada" && estado !== "Completada") {
    return NextResponse.json({ error: "Guía ya despachada, no se puede editar" }, { status: 400 });
  }

  const u: Record<string, unknown> = {};
  if (fecha !== undefined) u.fecha = fecha;
  if (modo_entrega !== undefined) {
    u.modo_entrega = modo_entrega;
    u.transportista_id = modo_entrega === "transportista" ? (transportista_id || null) : null;
    u.transportista = modo_entrega === "transportista" ? (String(transportista || "").trim() || null) : null;
  }
  if (placa !== undefined) u.placa = placa;
  if (observaciones !== undefined) u.observaciones = observaciones;
  if (monto_total !== undefined) u.monto_total = monto_total || 0;
  if (estado !== undefined) u.estado = estado;
  if (motivo_rechazo !== undefined) u.motivo_rechazo = motivo_rechazo;
  if (receptor_nombre !== undefined) u.receptor_nombre = receptor_nombre;
  if (cedula !== undefined) u.cedula = cedula;
  if (firma_base64 !== undefined) u.firma_base64 = firma_base64;
  if (firma_entregador_base64 !== undefined) u.firma_entregador_base64 = firma_entregador_base64;
  if (entregado_por !== undefined) u.entregado_por = entregado_por;
  if (numero_guia_transp !== undefined) u.numero_guia_transp = numero_guia_transp;
  if (tipo_despacho !== undefined) u.tipo_despacho = tipo_despacho;
  if (nombre_chofer !== undefined) u.nombre_chofer = nombre_chofer;

  const { error: guiaErr } = await db.from("guia_transporte").update(u).eq("id", id);
  if (guiaErr) return NextResponse.json({ error: guiaErr.message }, { status: 500 });

  // Reemplazo seguro de items: insertar nuevos (orden negativo) → borrar viejos → flip a positivo.
  if (items !== undefined) {
    if (items && items.length > 0) {
      const rows = items.map((item: Record<string, unknown>, i: number) => ({
        guia_id: id, orden: -(i + 1),
        cliente: item.cliente || "", direccion: item.direccion || "",
        facturas: item.facturas || "", bultos: item.bultos || 0,
        numero_guia_transp: item.numero_guia_transp || "",
      }));
      const { error: insErr } = await db.from("guia_items").insert(rows);
      if (insErr) {
        await db.from("guia_items").delete().eq("guia_id", id).lt("orden", 0);
        return NextResponse.json({ error: insErr.message }, { status: 500 });
      }
      await db.from("guia_items").delete().eq("guia_id", id).gte("orden", 0);
      const { data: nuevos } = await db.from("guia_items").select("id, orden").eq("guia_id", id).lt("orden", 0);
      if (nuevos && nuevos.length > 0) {
        const res = await Promise.allSettled(nuevos.map((n) => db.from("guia_items").update({ orden: -n.orden }).eq("id", n.id)));
        const failed = res.filter((r) => r.status === "rejected");
        if (failed.length > 0) return NextResponse.json({ error: `Items parcialmente actualizados (${failed.length}/${nuevos.length})` }, { status: 500 });
      }
    } else {
      await db.from("guia_items").delete().eq("guia_id", id);
    }
  }

  const data = await reFetch(db, id);
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireRoles(req, [...ROLES_GUIAS]);
  if (auth instanceof NextResponse) return auth;
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  const db = getSupabaseServer();
  const body = await req.json();
  const allowed = ["placa", "observaciones", "estado", "receptor_nombre", "cedula", "firma_base64", "firma_entregador_base64", "entregado_por", "numero_guia_transp", "nombre_entregador", "cedula_entregador", "tipo_despacho", "nombre_chofer", "motivo_rechazo"];
  const update: Record<string, unknown> = {};
  for (const k of allowed) if (body[k] !== undefined) update[k] = body[k];
  if (Object.keys(update).length === 0) return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });

  if (body.estado) {
    const { data: current } = await db.from("guia_transporte").select("estado").eq("id", params.id).single();
    if (current?.estado === "Completada" && body.estado === "Completada") return NextResponse.json({ error: "Esta guía ya fue despachada" }, { status: 400 });
    if (current?.estado === "Completada" && body.estado !== "Completada") return NextResponse.json({ error: "Guía ya despachada, no se puede editar" }, { status: 400 });
  }

  // Anti-carrera: al completar, solo actualiza si NO está ya Completada.
  let query = db.from("guia_transporte").update(update).eq("id", params.id);
  if (body.estado === "Completada") query = query.neq("estado", "Completada");
  const { data: updated, error } = await query.select("id").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!updated) return NextResponse.json({ error: "Guía no encontrada o ya despachada" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  // Soft-delete acotado a admin/secretaria.
  const auth = requireRoles(req, ["admin", "secretaria"]);
  if (auth instanceof NextResponse) return auth;
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  const { error } = await getSupabaseServer().from("guia_transporte").update({ deleted: true }).eq("id", params.id);
  if (error) return NextResponse.json({ error: "Error interno" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
