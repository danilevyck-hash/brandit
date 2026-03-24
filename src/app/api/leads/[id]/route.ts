import { getSupabaseAF } from "@/lib/supabase-af";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(_request: NextRequest, { params }: { params: { id: string } }) {
  const body = await _request.json();

  const { data, error } = await getSupabaseAF()
    .from("leads")
    .update(body)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await getSupabaseAF().from("leads").delete().eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
