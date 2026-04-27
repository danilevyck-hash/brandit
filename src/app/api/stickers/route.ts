import { getSupabaseAF } from "@/lib/supabase-af";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await getSupabaseAF()
    .from("stickers")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const { data, error } = await getSupabaseAF()
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
