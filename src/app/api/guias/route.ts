// GET (lista) + POST (crear) de Guías. Portado del molde de fashiongr.
// Auth Brand It (todos los roles). Mono-empresa: items sin columna empresa.
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { requireRoles } from "@/lib/auth-brandit";

export const dynamic = "force-dynamic";

const ROLES_GUIAS = ["admin", "secretaria", "vendedora1", "vendedora2"] as const;

type TransportistaJoin = { nombre: string | null } | { nombre: string | null }[] | null;
function transportistaLabel(row: { modo_entrega?: string | null; transportistas?: TransportistaJoin }): string {
  if (row.modo_entrega === "entrega_directa") return "Entrega directa";
  const j = Array.isArray(row.transportistas) ? row.transportistas[0] : row.transportistas;
  return j?.nombre || "";
}

export async function GET(req: NextRequest) {
  const auth = requireRoles(req, [...ROLES_GUIAS]);
  if (auth instanceof NextResponse) return auth;

  // SELECT explícito sin firmas base64 (pesan 30-100KB; el detalle las trae).
  const { data, error } = await getSupabaseServer()
    .from("guia_transporte")
    .select("id, numero, fecha, modo_entrega, transportista_id, transportistas(nombre), placa, observaciones, monto_total, estado, tipo_despacho, motivo_rechazo, receptor_nombre, nombre_entregador, entregado_por, nombre_chofer, numero_guia_transp, created_at, deleted, guia_items(bultos, facturas, cliente)")
    .eq("deleted", false)
    .order("numero", { ascending: false });

  if (error) { console.error("[api/guias] GET", error); return NextResponse.json({ error: "Error interno" }, { status: 500 }); }

  const result = (data || []).map((g) => ({
    ...g,
    transportista: transportistaLabel(g),
    total_bultos: (g.guia_items || []).reduce((s: number, i: { bultos: number }) => s + (i.bultos || 0), 0),
    item_count: (g.guia_items || []).length,
  }));
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const auth = requireRoles(req, [...ROLES_GUIAS]);
  if (auth instanceof NextResponse) return auth;
  const db = getSupabaseServer();
  const body = await req.json();
  const { fecha, modo_entrega, transportista_id, placa, observaciones, items, monto_total, estado, entregado_por } = body;

  if (modo_entrega !== "transportista" && modo_entrega !== "entrega_directa") {
    return NextResponse.json({ error: "Debes indicar el modo de entrega" }, { status: 400 });
  }
  if (modo_entrega === "transportista" && !transportista_id) {
    return NextResponse.json({ error: "Selecciona un transportista" }, { status: 400 });
  }
  if (!items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "La guía debe tener al menos un item" }, { status: 400 });
  }
  const totalBultos = items.reduce((s: number, i: { bultos?: number }) => s + (i.bultos || 0), 0);
  if (totalBultos === 0) {
    return NextResponse.json({ error: "La guía debe tener al menos un item con bultos > 0" }, { status: 400 });
  }

  // Numeración auto-incremental con retry anti-carrera (depende de UNIQUE(numero)).
  let guia: Record<string, unknown> | null = null;
  let guiaErr: { message: string } | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: last } = await db.from("guia_transporte").select("numero").order("numero", { ascending: false }).limit(1).maybeSingle();
    const numero = (last?.numero || 0) + 1;
    const insertData: Record<string, unknown> = {
      numero, fecha,
      modo_entrega,
      transportista_id: modo_entrega === "transportista" ? transportista_id : null,
      placa: placa || null,
      observaciones: observaciones || null,
      monto_total: monto_total || 0,
      estado: estado || "Pendiente Bodega",
      entregado_por: entregado_por || null,
    };
    const { data, error } = await db.from("guia_transporte").insert(insertData).select().single();
    if (!error) { guia = data; guiaErr = null; break; }
    if (error.message?.includes("unique") || error.message?.includes("duplicate") || error.message?.includes("23505")) continue;
    guiaErr = error; break;
  }
  if (guiaErr || !guia) return NextResponse.json({ error: guiaErr?.message || "Error al crear guía" }, { status: 500 });

  const rows = items.map((item: Record<string, unknown>, i: number) => ({
    guia_id: guia!.id, orden: i + 1,
    cliente: item.cliente || "", direccion: item.direccion || "",
    facturas: item.facturas || "", bultos: item.bultos || 0,
    numero_guia_transp: item.numero_guia_transp || "",
  }));
  const { error: itemsErr } = await db.from("guia_items").insert(rows);
  if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 });

  return NextResponse.json(guia);
}
