import { getSupabaseServer } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { requireRoles } from "@/lib/auth-brandit";

export const dynamic = "force-dynamic";

const COMPANY_KEY = "confecciones_boston";

export async function GET(req: NextRequest) {
  const auth = requireRoles(req, ["admin", "secretaria"]);
  if (auth instanceof NextResponse) return auth;

  const db = getSupabaseServer();
  const { data, error } = await db
    .from("cxc_favoritos")
    .select("nombre_normalized")
    .eq("company_key", COMPANY_KEY);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ favoritos: (data || []).map((f) => f.nombre_normalized) });
}

export async function POST(request: NextRequest) {
  const auth = requireRoles(request, ["admin", "secretaria"]);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const nombres: string[] = Array.isArray(body.nombres_normalized)
    ? body.nombres_normalized
    : body.nombre_normalized
    ? [body.nombre_normalized]
    : [];

  if (nombres.length === 0) {
    return NextResponse.json({ error: "nombre_normalized requerido" }, { status: 400 });
  }

  const db = getSupabaseServer();
  const rows = nombres.map((n) => ({ company_key: COMPANY_KEY, nombre_normalized: n }));

  const { error } = await db
    .from("cxc_favoritos")
    .upsert(rows, { onConflict: "company_key,nombre_normalized", ignoreDuplicates: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const auth = requireRoles(request, ["admin", "secretaria"]);
  if (auth instanceof NextResponse) return auth;

  const nombre = request.nextUrl.searchParams.get("nombre_normalized");
  if (!nombre) {
    return NextResponse.json({ error: "nombre_normalized requerido" }, { status: 400 });
  }

  const db = getSupabaseServer();
  const { error } = await db
    .from("cxc_favoritos")
    .delete()
    .eq("company_key", COMPANY_KEY)
    .eq("nombre_normalized", nombre);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
