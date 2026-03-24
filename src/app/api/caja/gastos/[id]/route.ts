import { getSupabaseAF } from "@/lib/supabase-af";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await getSupabaseAF().from("caja_gastos").delete().eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
