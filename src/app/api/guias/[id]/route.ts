import { getSupabaseServer } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { requireRoles } from "@/lib/auth-brandit";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireRoles(request, ["admin", "secretaria", "vendedora1", "vendedora2"]);
  if (auth instanceof NextResponse) return auth;

  const { data, error } = await getSupabaseServer()
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

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireRoles(request, ["admin", "secretaria", "vendedora1", "vendedora2"]);
  if (auth instanceof NextResponse) return auth;

  // Delete items first
  await getSupabaseServer().from("guia_items").delete().eq("guia_id", params.id);

  const { error } = await getSupabaseServer().from("guia_transporte").delete().eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
