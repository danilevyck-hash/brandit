import { getSupabaseAF } from "@/lib/supabase-af";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const { data, error } = await getSupabaseAF()
    .from("guia_transporte")
    .select("*, items:guia_items(*)")
    .eq("id", params.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Sort items by orden
  if (data.items) {
    data.items.sort((a: { orden: number }, b: { orden: number }) => a.orden - b.orden);
  }

  return NextResponse.json(data);
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  // Delete items first
  await getSupabaseAF().from("guia_items").delete().eq("guia_id", params.id);

  const { error } = await getSupabaseAF().from("guia_transporte").delete().eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
