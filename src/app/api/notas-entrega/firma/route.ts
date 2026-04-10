import { getSupabaseAF } from "@/lib/supabase-af";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const nombre = request.nextUrl.searchParams.get("nombre");

  if (!nombre) {
    return NextResponse.json({ error: "nombre requerido" }, { status: 400 });
  }

  const { data, error } = await getSupabaseAF()
    .from("admin_firmas")
    .select("*")
    .eq("nombre", nombre)
    .single();

  if (error) return NextResponse.json({ firma_base64: null });

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  if (!body.nombre || !body.firma_base64) {
    return NextResponse.json({ error: "nombre y firma_base64 requeridos" }, { status: 400 });
  }

  // Upsert: update if exists, insert if not
  const { data: existing } = await getSupabaseAF()
    .from("admin_firmas")
    .select("id")
    .eq("nombre", body.nombre)
    .single();

  if (existing) {
    const { data, error } = await getSupabaseAF()
      .from("admin_firmas")
      .update({
        firma_base64: body.firma_base64,
        updated_at: new Date().toISOString(),
      })
      .eq("nombre", body.nombre)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  const { data, error } = await getSupabaseAF()
    .from("admin_firmas")
    .insert([
      {
        nombre: body.nombre,
        firma_base64: body.firma_base64,
      },
    ])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}
