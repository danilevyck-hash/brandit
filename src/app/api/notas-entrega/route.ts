import { getSupabaseAF } from "@/lib/supabase-af";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams.get("search") || "";
  const estado = request.nextUrl.searchParams.get("estado") || "";
  const tipo = request.nextUrl.searchParams.get("tipo") || "";

  let query = getSupabaseAF()
    .from("notas_entrega")
    .select("*, items:notas_entrega_items(*)")
    .order("id", { ascending: false });

  if (estado && estado !== "todas") {
    query = query.eq("estado", estado);
  }

  if (tipo && tipo !== "todos") {
    query = query.eq("tipo", tipo);
  }

  if (search) {
    query = query.or(`cliente.ilike.%${search}%,numero.ilike.%${search}%`);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const result = (data || []).map((n) => ({
    ...n,
    items_count: (n.items || []).length,
    total_cantidad: (n.items || []).reduce(
      (sum: number, i: { cantidad: number }) => sum + Number(i.cantidad || 0),
      0
    ),
  }));

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const tipoValue = body.tipo === "muestras" ? "muestras" : "pedido";
  const prefix = tipoValue === "muestras" ? "NM" : "NE";

  // Get next numero for this tipo (independent sequence)
  const { data: last } = await getSupabaseAF()
    .from("notas_entrega")
    .select("numero")
    .eq("tipo", tipoValue)
    .order("id", { ascending: false })
    .limit(1);

  let nextNum = 1;
  if (last && last.length > 0) {
    const match = last[0].numero.match(new RegExp(`${prefix}-(\\d+)`));
    if (match) nextNum = parseInt(match[1], 10) + 1;
  }

  const numero = `${prefix}-${String(nextNum).padStart(3, "0")}`;

  const { data: nota, error } = await getSupabaseAF()
    .from("notas_entrega")
    .insert([
      {
        numero,
        fecha: body.fecha,
        cliente: body.cliente,
        atencion: body.atencion || null,
        contacto: body.contacto || null,
        numero_contacto: body.numero_contacto || null,
        tipo: tipoValue,
        estado: "abierta",
        created_by: body.created_by || null,
      },
    ])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Insert items
  if (body.items && body.items.length > 0) {
    const items = body.items.map((item: Record<string, unknown>, idx: number) => ({
      nota_id: nota.id,
      marca: item.marca || null,
      descripcion: item.descripcion,
      color: item.color || null,
      talla: item.talla || null,
      cantidad: Number(item.cantidad) || 1,
      sort_order: idx,
    }));

    const { error: iError } = await getSupabaseAF().from("notas_entrega_items").insert(items);
    if (iError) return NextResponse.json({ error: iError.message }, { status: 500 });
  }

  return NextResponse.json(nota);
}
