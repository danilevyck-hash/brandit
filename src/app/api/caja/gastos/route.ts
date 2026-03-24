import { getSupabaseAF } from "@/lib/supabase-af";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json();

  const itbms = body.itbms || 0;
  const subtotal = Number(body.subtotal);
  const total = subtotal + subtotal * (itbms / 100);

  const { data, error } = await getSupabaseAF()
    .from("caja_gastos")
    .insert([
      {
        periodo_id: body.periodo_id,
        fecha: body.fecha,
        empresa: body.empresa,
        descripcion: body.descripcion,
        subtotal,
        itbms: subtotal * (itbms / 100),
        total,
      },
    ])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
