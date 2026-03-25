import { getSupabaseAF } from "@/lib/supabase-af";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await getSupabaseAF()
    .from("cxc_uploads")
    .select("*")
    .eq("company_key", "confecciones_boston")
    .order("uploaded_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}
