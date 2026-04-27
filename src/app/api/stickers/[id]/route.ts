import { getSupabaseAF } from "@/lib/supabase-af";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const { data, error } = await getSupabaseAF()
    .from("stickers")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json();

  const updates: Record<string, string> = {};
  if (typeof body.descripcion === "string") updates.descripcion = body.descripcion;
  if (typeof body.talla === "string") updates.talla = body.talla;
  if (typeof body.color_nombre === "string") updates.color_nombre = body.color_nombre;
  if (typeof body.color_hex === "string") updates.color_hex = body.color_hex;
  if (typeof body.seccion === "string") updates.seccion = body.seccion;
  if (typeof body.estante === "string") updates.estante = body.estante;
  updates.updated_at = new Date().toISOString();

  const { data, error } = await getSupabaseAF()
    .from("stickers")
    .update(updates)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await getSupabaseAF().from("stickers").delete().eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
