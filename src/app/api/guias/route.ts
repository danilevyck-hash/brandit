import { getSupabaseAF } from "@/lib/supabase-af";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await getSupabaseAF()
    .from("guia_transporte")
    .select("*, items:guia_items(*)")
    .order("numero", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const result = (data || []).map((g) => ({
    ...g,
    total_bultos: (g.items || []).reduce(
      (sum: number, i: { bultos: number }) => sum + Number(i.bultos || 0),
      0
    ),
    total_items: (g.items || []).length,
  }));

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  // Get next numero
  const { data: last } = await getSupabaseAF()
    .from("guia_transporte")
    .select("numero")
    .order("numero", { ascending: false })
    .limit(1);

  const numero = last && last.length > 0 ? last[0].numero + 1 : 1;

  const { data: guia, error } = await getSupabaseAF()
    .from("guia_transporte")
    .insert([
      {
        numero,
        fecha: body.fecha,
        transportista: body.transportista,
        placa: body.placa,
        observaciones: body.observaciones || null,
      },
    ])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Insert items
  if (body.items && body.items.length > 0) {
    const items = body.items.map((item: Record<string, unknown>, idx: number) => ({
      guia_id: guia.id,
      orden: idx + 1,
      cliente: item.cliente,
      direccion: item.direccion,
      empresa: item.empresa,
      facturas: item.facturas,
      bultos: Number(item.bultos) || 0,
      numero_guia_transp: item.numero_guia_transp,
    }));

    const { error: iError } = await getSupabaseAF().from("guia_items").insert(items);
    if (iError) return NextResponse.json({ error: iError.message }, { status: 500 });
  }

  return NextResponse.json(guia);
}
