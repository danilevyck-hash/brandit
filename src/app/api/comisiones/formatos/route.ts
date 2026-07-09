// Config de formato de comisión por vendedor (comisiones_config_vendedor). Solo admin.
//   GET  → filas de config + vendedores detectados (recibos + facturas de los
//          últimos 3 meses) que aún NO tienen formato asignado.
//   PUT  → upsert [{vendedor_nombre, formato: 'A'|'B', activo}]. Los nombres se
//          normalizan (TRIM + espacios colapsados + MAYÚSCULAS) al guardar.
// Tasas NO configurables: A = tramos fijos por recibo; B = 1% fijo venta y cobro.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { requireRoles } from "@/lib/auth-brandit";
import { logActivity } from "@/lib/activity-log";
import { getSessionPayload } from "@/lib/auth-brandit";
import { normalizeVendedor } from "@/lib/comisiones";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = requireRoles(req, ["admin"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const db = getSupabaseServer();
    const { data: config, error } = await db
      .from("comisiones_config_vendedor")
      .select("vendedor_nombre,formato,activo,updated_at")
      .order("vendedor_nombre", { ascending: true });
    if (error) throw new Error(error.message);

    // Vendedores vistos en los últimos ~3 meses sin formato asignado.
    const desde = new Date();
    desde.setUTCMonth(desde.getUTCMonth() - 3);
    const desdeIso = desde.toISOString().slice(0, 10);
    const configurados = new Set((config ?? []).map((c) => normalizeVendedor(c.vendedor_nombre as string)));

    const [recibosRes, facturasRes] = await Promise.all([
      db.from("switch_recibos").select("vendedor_nombre").gte("fecha", desdeIso).range(0, 99999),
      db.from("switch_facturas").select("vendedor_nombre").gte("fecha", desdeIso).range(0, 99999),
    ]);
    if (recibosRes.error) throw new Error(recibosRes.error.message);
    if (facturasRes.error) throw new Error(facturasRes.error.message);

    const sinAsignar = new Set<string>();
    for (const r of [...(recibosRes.data ?? []), ...(facturasRes.data ?? [])]) {
      const v = normalizeVendedor((r as { vendedor_nombre: string | null }).vendedor_nombre);
      if (v && !configurados.has(v)) sinAsignar.add(v);
    }

    return NextResponse.json({
      config: config ?? [],
      sinAsignar: Array.from(sinAsignar).sort(),
    });
  } catch (e) {
    console.error("[comisiones formatos GET]", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = requireRoles(req, ["admin"]);
  if (auth instanceof NextResponse) return auth;
  const session = getSessionPayload(req);

  let body: { updates?: { vendedor_nombre?: string; formato?: string; activo?: boolean }[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const updates = Array.isArray(body.updates) ? body.updates : [];
  if (updates.length === 0) {
    return NextResponse.json({ error: "Sin cambios que guardar" }, { status: 400 });
  }

  const rows: { vendedor_nombre: string; formato: string; activo: boolean; updated_at: string }[] = [];
  for (const u of updates) {
    const nombre = normalizeVendedor(u.vendedor_nombre);
    if (!nombre) {
      return NextResponse.json({ error: "Falta el nombre del vendedor" }, { status: 400 });
    }
    if (u.formato !== "A" && u.formato !== "B") {
      return NextResponse.json({ error: `Formato inválido para ${nombre} (A o B)` }, { status: 400 });
    }
    rows.push({
      vendedor_nombre: nombre,
      formato: u.formato,
      activo: u.activo !== false,
      updated_at: new Date().toISOString(),
    });
  }

  try {
    const { error } = await getSupabaseServer()
      .from("comisiones_config_vendedor")
      .upsert(rows, { onConflict: "vendedor_nombre" });
    if (error) throw new Error(error.message);

    await logActivity(
      session?.nombre || String(auth),
      "comisiones_formatos",
      rows.map((r) => `${r.vendedor_nombre}=${r.formato}${r.activo ? "" : " (inactivo)"}`).join(", "),
    );
    return NextResponse.json({ ok: true, guardados: rows.length });
  } catch (e) {
    console.error("[comisiones formatos PUT]", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
