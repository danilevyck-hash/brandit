import { getSupabaseServer } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { requireRoles } from "@/lib/auth-brandit";

export const dynamic = "force-dynamic";

// Máximo numérico real de los números con este prefijo (NE-### / NM-###).
// La constraint `notas_entrega_numero_key` es GLOBAL sobre la columna `numero`,
// así que el namespace lo define el PREFIJO, no el tipo: hay que mirar todas las
// filas del prefijo (incluida cualquier NE- legacy que quedó bajo otro tipo).
function maxNumeroForPrefix(rows: { numero: string | null }[] | null, prefix: string): number {
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  let max = 0;
  for (const row of rows || []) {
    const match = (row.numero || "").match(re);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > max) max = n;
    }
  }
  return max;
}

export async function GET(request: NextRequest) {
  const auth = requireRoles(request, ["admin", "secretaria", "vendedora"]);
  if (auth instanceof NextResponse) return auth;

  const search = request.nextUrl.searchParams.get("search") || "";
  const estado = request.nextUrl.searchParams.get("estado") || "";
  const tipo = request.nextUrl.searchParams.get("tipo") || "";

  let query = getSupabaseServer()
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
  const auth = requireRoles(request, ["admin", "secretaria", "vendedora"]);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();

  const tipoValue = body.tipo === "muestras" ? "muestras" : "pedido";
  const prefix = tipoValue === "muestras" ? "NM" : "NE";

  // Genera el número desde el MÁXIMO NUMÉRICO real del prefijo + reintenta ante
  // colisión de unique (23505). El recálculo dentro del loop cubre carreras:
  // si dos notas se crean a la vez, la que pierde recalcula y toma el siguiente.
  const MAX_RETRIES = 3;
  let nota: { id: number; numero: string; [key: string]: unknown } | null = null;
  let lastError: { message: string } | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const { data: existing } = await getSupabaseServer()
      .from("notas_entrega")
      .select("numero")
      .ilike("numero", `${prefix}-%`);

    const nextNum = maxNumeroForPrefix(existing, prefix) + 1;
    const numero = `${prefix}-${String(nextNum).padStart(3, "0")}`;

    const { data, error } = await getSupabaseServer()
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
          // Todas las notas (muestras y pedido) nacen "abierta". Sin paso de aprobación.
          estado: "abierta",
          created_by: body.created_by || null,
        },
      ])
      .select()
      .single();

    if (!error) {
      nota = data;
      break;
    }

    // 23505 = unique_violation → número tomado (carrera o legacy): recalcular y reintentar.
    const isDuplicate =
      (error as { code?: string }).code === "23505" || /duplicate key/i.test(error.message || "");
    if (isDuplicate) {
      lastError = error;
      continue;
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!nota) {
    return NextResponse.json(
      { error: lastError?.message || "No se pudo generar el número de la nota. Intenta de nuevo." },
      { status: 500 }
    );
  }

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

    const { error: iError } = await getSupabaseServer().from("notas_entrega_items").insert(items);
    if (iError) return NextResponse.json({ error: iError.message }, { status: 500 });
  }

  return NextResponse.json(nota);
}
