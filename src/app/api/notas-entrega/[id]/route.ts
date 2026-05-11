import { getSupabaseServer } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { requireRoles } from "@/lib/auth-brandit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest,
  { params }: { params: { id: string } }) {
  const auth = requireRoles(request, ["admin", "secretaria", "vendedora1", "vendedora2"]);
  if (auth instanceof NextResponse) return auth;

  const { data, error } = await getSupabaseServer()
    .from("notas_entrega")
    .select("*, items:notas_entrega_items(*)")
    .eq("id", params.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  return NextResponse.json(data);
}

export async function PUT(request: NextRequest,
  { params }: { params: { id: string } }) {
  const auth = requireRoles(request, ["admin", "secretaria", "vendedora1", "vendedora2"]);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();

  // Check if nota is not cerrada
  const { data: existing } = await getSupabaseServer()
    .from("notas_entrega")
    .select("estado")
    .eq("id", params.id)
    .single();

  if (existing?.estado === "cerrada") {
    return NextResponse.json({ error: "No se puede editar una nota cerrada" }, { status: 400 });
  }

  // Update nota
  const { error } = await getSupabaseServer()
    .from("notas_entrega")
    .update({
      cliente: body.cliente,
      atencion: body.atencion || null,
      contacto: body.contacto || null,
      numero_contacto: body.numero_contacto || null,
      tipo: body.tipo === "muestras" ? "muestras" : "pedido",
      fecha: body.fecha,
    })
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Delete old items and re-insert
  await getSupabaseServer().from("notas_entrega_items").delete().eq("nota_id", params.id);

  if (body.items && body.items.length > 0) {
    const items = body.items.map((item: Record<string, unknown>, idx: number) => ({
      nota_id: Number(params.id),
      marca: item.marca || null,
      descripcion: item.descripcion,
      color: item.color || null,
      talla: item.talla || null,
      cantidad: Number(item.cantidad) || 1,
      sort_order: idx,
    }));

    const { error: iError } = await getSupabaseServer().from("notas_entrega_items").insert(items);
    if (iError) return NextResponse.json({ error: iError.message }, { status: 500 });
  }

  // Return updated
  const { data: updated } = await getSupabaseServer()
    .from("notas_entrega")
    .select("*, items:notas_entrega_items(*)")
    .eq("id", params.id)
    .single();

  return NextResponse.json(updated);
}

export async function PATCH(request: NextRequest,
  { params }: { params: { id: string } }) {
  const auth = requireRoles(request, ["admin", "secretaria", "vendedora1", "vendedora2"]);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();

  const updateData: Record<string, unknown> = {};

  if (body.estado === "aprobada") {
    updateData.estado = "aprobada";
    updateData.aprobado_por = body.aprobado_por;
    updateData.aprobado_at = new Date().toISOString();
  }

  if (body.estado === "cerrada") {
    updateData.estado = "cerrada";
    updateData.cerrada_at = new Date().toISOString();
    if (body.scan_url) updateData.scan_url = body.scan_url;
  }

  if (body.scan_url && !body.estado) {
    updateData.scan_url = body.scan_url;
  }

  const { data, error } = await getSupabaseServer()
    .from("notas_entrega")
    .update(updateData)
    .eq("id", params.id)
    .select("*, items:notas_entrega_items(*)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest,
  { params }: { params: { id: string } }) {
  const auth = requireRoles(request, ["admin", "secretaria", "vendedora1", "vendedora2"]);
  if (auth instanceof NextResponse) return auth;

  // Only delete if abierta
  const { data: existing } = await getSupabaseServer()
    .from("notas_entrega")
    .select("estado")
    .eq("id", params.id)
    .single();

  if (existing?.estado !== "abierta") {
    return NextResponse.json({ error: "Solo se pueden eliminar notas abiertas" }, { status: 400 });
  }

  const { error } = await getSupabaseServer()
    .from("notas_entrega")
    .delete()
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
