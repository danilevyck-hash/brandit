import { getSupabaseAF } from "@/lib/supabase-af";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(_request: NextRequest, { params }: { params: { id: string } }) {
  const { data, error } = await getSupabaseAF()
    .from("caja_responsables")
    .update({ activo: false })
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
