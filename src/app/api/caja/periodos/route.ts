import { getSupabaseAF } from "@/lib/supabase-af";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await getSupabaseAF()
    .from("caja_periodos")
    .select("*, gastos:caja_gastos(total)")
    .order("numero", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const result = (data || []).map((p) => {
    const totalGastado = (p.gastos || []).reduce(
      (sum: number, g: { total: number }) => sum + Number(g.total),
      0
    );
    return {
      ...p,
      total_gastado: totalGastado,
      saldo: Number(p.fondo_inicial) - totalGastado,
      gastos: undefined,
    };
  });

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  // Check no open period exists
  const { data: open } = await getSupabaseAF()
    .from("caja_periodos")
    .select("id")
    .eq("estado", "abierto")
    .limit(1);

  if (open && open.length > 0) {
    return NextResponse.json(
      { error: "Ya existe un período abierto. Ciérrelo antes de crear uno nuevo." },
      { status: 400 }
    );
  }

  // Get next numero
  const { data: last } = await getSupabaseAF()
    .from("caja_periodos")
    .select("numero")
    .order("numero", { ascending: false })
    .limit(1);

  const numero = last && last.length > 0 ? last[0].numero + 1 : 1;

  const { data, error } = await getSupabaseAF()
    .from("caja_periodos")
    .insert([
      {
        numero,
        fecha_apertura: new Date().toISOString().split("T")[0],
        fondo_inicial: body.fondo_inicial || 200,
        estado: "abierto",
      },
    ])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
