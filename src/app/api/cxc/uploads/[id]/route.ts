import { getSupabaseAF } from "@/lib/supabase-af";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const db = getSupabaseAF();

  // Delete rows first (foreign key)
  await db.from("cxc_rows").delete().eq("upload_id", params.id);

  // Delete upload record
  const { error } = await db.from("cxc_uploads").delete().eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
