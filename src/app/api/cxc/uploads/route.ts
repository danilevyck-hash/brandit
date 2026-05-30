import { getSupabaseServer } from "@/lib/supabase-server";
import { NextResponse, NextRequest } from "next/server";
import { requireRoles } from "@/lib/auth-brandit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = requireRoles(req, ["admin"]);
  if (auth instanceof NextResponse) return auth;

  const { data, error } = await getSupabaseServer()
    .from("cxc_uploads")
    .select("*")
    .eq("company_key", "confecciones_boston")
    .order("uploaded_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}
