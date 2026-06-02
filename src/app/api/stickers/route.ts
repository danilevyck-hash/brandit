import { getSupabaseServer } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { requireRoles } from "@/lib/auth-brandit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = requireRoles(req, ["admin"]);
  if (auth instanceof NextResponse) return auth;

  const { data, error } = await getSupabaseServer()
    .from("stickers")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const auth = requireRoles(request, ["admin"]);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();

  const { data, error } = await getSupabaseServer()
    .from("stickers")
    .insert([
      {
        descripcion: body.descripcion,
        talla: body.talla,
        color_nombre: body.color_nombre,
        color_hex: body.color_hex,
        seccion: body.seccion,
        estante: body.estante,
      },
    ])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
