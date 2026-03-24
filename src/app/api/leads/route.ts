import { getSupabaseAF } from "@/lib/supabase-af";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const estado = request.nextUrl.searchParams.get("estado");

  let query = getSupabaseAF()
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });

  if (estado) query = query.eq("estado", estado);

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const { data, error } = await getSupabaseAF()
    .from("leads")
    .insert([
      {
        nombre: body.nombre,
        empresa: body.empresa || null,
        telefono: body.telefono || null,
        email: body.email || null,
        estado: body.estado || "interesado",
        notas: body.notas || null,
        vendedora: body.vendedora || null,
      },
    ])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
