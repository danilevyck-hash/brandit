import { getSupabaseAF } from "@/lib/supabase-af";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;

  const { data: periodo, error } = await getSupabaseAF()
    .from("caja_periodos")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: gastos, error: gError } = await getSupabaseAF()
    .from("caja_gastos")
    .select("*")
    .eq("periodo_id", id)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });

  if (gError) return NextResponse.json({ error: gError.message }, { status: 500 });

  const totalGastado = (gastos || []).reduce((sum, g) => sum + Number(g.total), 0);

  return NextResponse.json({
    ...periodo,
    gastos: gastos || [],
    total_gastado: totalGastado,
    saldo: Number(periodo.fondo_inicial) - totalGastado,
  });
}

export async function PATCH(_request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const body = await _request.json();

  // If closing the period
  if (body.estado === "cerrado") {
    body.fecha_cierre = new Date().toISOString().split("T")[0];
  }

  const { data, error } = await getSupabaseAF()
    .from("caja_periodos")
    .update(body)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;

  // Delete associated gastos first
  await getSupabaseAF().from("caja_gastos").delete().eq("periodo_id", id);

  const { error } = await getSupabaseAF().from("caja_periodos").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
