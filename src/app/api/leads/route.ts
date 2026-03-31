import { getSupabaseAF } from "@/lib/supabase-af";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const estado = request.nextUrl.searchParams.get("estado");
  const vendedora = request.nextUrl.searchParams.get("vendedora");
  const empresa = request.nextUrl.searchParams.get("empresa");

  let query = getSupabaseAF()
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });

  if (estado) query = query.eq("estado", estado);
  if (vendedora) query = query.eq("vendedora", vendedora);
  if (empresa) query = query.eq("empresa", empresa);

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const { data, error } = await getSupabaseAF()
    .from("leads")
    .insert([{
      nombre: body.nombre,
      empresa: body.empresa || null,
      telefono: body.telefono || null,
      email: body.email || null,
      estado: body.estado || "interesado",
      estado_venta: body.estado_venta || "activo",
      notas: body.notas || null,
      vendedora: body.vendedora || null,
      fecha_seguimiento: body.fecha_seguimiento || null,
      asignado_a: body.asignado_a || null,
    }])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
