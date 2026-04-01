import { getSupabaseAF } from "@/lib/supabase-af";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await getSupabaseAF()
    .from("activity_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}
