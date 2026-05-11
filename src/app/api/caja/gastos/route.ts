import { getSupabaseServer } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { requireRoles } from "@/lib/auth-brandit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = requireRoles(request, ["admin", "secretaria", "vendedora1", "vendedora2"]);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();

  const itbms = body.itbms || 0;
  const subtotal = Number(body.subtotal);
  const total = subtotal + subtotal * (itbms / 100);

  const { data, error } = await getSupabaseServer()
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
        responsable: body.responsable || null,
        categoria: body.categoria || null,
        proveedor: body.proveedor || null,
        estado: body.estado || "completado",
      },
    ])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
