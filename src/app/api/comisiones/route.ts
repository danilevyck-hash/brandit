// Comisiones por cobro (switch_recibos). Solo admin.
//   GET ?anio=&mes=[&vendedores=&clientes_excluidos=] → cálculo en vivo del mes
//       (o el snapshot congelado si ya existe para ese mes).
//   POST → genera snapshot del mes (cabecera + detalle), idempotente por (anio, mes).
//
// Reglas: comisión por recibo, atribución por vendedor del recibo, EXCLUYE
// es_retencion. Tramos fijos (lib/comisiones). Total = suma de comisiones/recibo.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { logActivity } from "@/lib/activity-log";
import { requireRoles, getSessionPayload } from "@/lib/auth-brandit";
import {
  comisionRecibo, tasaPara, vendedorToken, round2,
  type ReciboRow, type ReciboCalculado, type VendedorAgregado,
} from "@/lib/comisiones";

export const dynamic = "force-dynamic";

function monthBounds(anio: number, mes: number) {
  const inicio = `${anio}-${String(mes).padStart(2, "0")}-01`;
  const ny = mes === 12 ? anio + 1 : anio;
  const nm = mes === 12 ? 1 : mes + 1;
  const finExcl = `${ny}-${String(nm).padStart(2, "0")}-01`;
  return { inicio, finExcl };
}

function esMesEnCurso(anio: number, mes: number): boolean {
  const d = new Date();
  return anio === d.getUTCFullYear() && mes === d.getUTCMonth() + 1;
}

function parseAnioMes(sp: URLSearchParams): { anio: number; mes: number } | NextResponse {
  const anio = parseInt(sp.get("anio") ?? "", 10);
  const mes = parseInt(sp.get("mes") ?? "", 10);
  if (!Number.isInteger(anio) || anio < 2024 || anio > 2100) {
    return NextResponse.json({ error: "anio inválido" }, { status: 400 });
  }
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
    return NextResponse.json({ error: "mes inválido (1..12)" }, { status: 400 });
  }
  return { anio, mes };
}

/** Trae los recibos del mes (todos, incluye retenciones) de switch_recibos. */
async function fetchRecibosMes(anio: number, mes: number): Promise<ReciboRow[]> {
  const { inicio, finExcl } = monthBounds(anio, mes);
  const { data, error } = await getSupabaseServer()
    .from("switch_recibos")
    .select("id,fecha,cliente_codigo,cliente_nombre,vendedor_id,vendedor_nombre,total,es_retencion")
    .gte("fecha", inicio)
    .lt("fecha", finExcl)
    .order("fecha", { ascending: true })
    .range(0, 99999);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id as number,
    fecha: r.fecha as string | null,
    cliente_codigo: r.cliente_codigo as string | null,
    cliente_nombre: r.cliente_nombre as string | null,
    vendedor_id: (r.vendedor_id as number | null) ?? null,
    vendedor_nombre: r.vendedor_nombre as string | null,
    total: Number(r.total ?? 0),
    es_retencion: Boolean(r.es_retencion),
  }));
}

/** Núcleo: aplica filtros, calcula tasa/comisión por recibo y agrega por vendedor. */
function calcular(recibos: ReciboRow[], vendedoresSel: Set<string> | null, clientesExcl: Set<string>) {
  const retenciones = recibos.filter((r) => r.es_retencion);
  const base = recibos.filter((r) => !r.es_retencion);

  // Listas para los filtros (del universo del mes, antes de aplicar selección).
  const vendMap = new Map<string, { id: number | null; nombre: string | null }>();
  const cliMap = new Map<string, string | null>();
  for (const r of base) {
    vendMap.set(vendedorToken(r.vendedor_id, r.vendedor_nombre), { id: r.vendedor_id, nombre: r.vendedor_nombre });
    if (r.cliente_codigo) cliMap.set(r.cliente_codigo, r.cliente_nombre);
  }

  const seleccionados = base.filter((r) => {
    const tok = vendedorToken(r.vendedor_id, r.vendedor_nombre);
    if (vendedoresSel && !vendedoresSel.has(tok)) return false;
    if (r.cliente_codigo && clientesExcl.has(r.cliente_codigo)) return false;
    return true;
  });

  const calculados: ReciboCalculado[] = seleccionados.map((r) => ({
    id: r.id, fecha: r.fecha, cliente_codigo: r.cliente_codigo, cliente_nombre: r.cliente_nombre,
    vendedor_id: r.vendedor_id, vendedor_nombre: r.vendedor_nombre,
    total: round2(r.total), tasa: tasaPara(r.total), comision: comisionRecibo(r.total),
  }));

  const agg = new Map<string, VendedorAgregado>();
  for (const r of calculados) {
    const tok = vendedorToken(r.vendedor_id, r.vendedor_nombre);
    const e = agg.get(tok) ?? { token: tok, vendedor_id: r.vendedor_id, vendedor_nombre: r.vendedor_nombre, num_recibos: 0, total_cobrado: 0, total_comision: 0 };
    e.num_recibos += 1;
    e.total_cobrado = round2(e.total_cobrado + r.total);
    e.total_comision = round2(e.total_comision + r.comision);
    agg.set(tok, e);
  }

  const totalCobrado = round2(calculados.reduce((a, r) => a + r.total, 0));
  const totalComision = round2(calculados.reduce((a, r) => a + r.comision, 0));

  return {
    recibos: calculados,
    porVendedor: Array.from(agg.values()).sort((a, b) => b.total_comision - a.total_comision),
    retenciones: retenciones.map((r) => ({ id: r.id, fecha: r.fecha, cliente_nombre: r.cliente_nombre, total: round2(r.total) })),
    vendedoresDisponibles: Array.from(vendMap.entries()).map(([token, v]) => ({ token, id: v.id, nombre: v.nombre }))
      .sort((a, b) => (a.nombre ?? "").localeCompare(b.nombre ?? "")),
    clientesDisponibles: Array.from(cliMap.entries()).map(([codigo, nombre]) => ({ codigo, nombre }))
      .sort((a, b) => (a.nombre ?? "").localeCompare(b.nombre ?? "")),
    totalCobrado,
    totalComision,
  };
}

async function loadSnapshotCabecera(anio: number, mes: number) {
  const { data, error } = await getSupabaseServer()
    .from("comisiones_snapshot")
    .select("*")
    .eq("anio", anio)
    .eq("mes", mes)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function GET(req: NextRequest) {
  const auth = requireRoles(req, ["admin"]);
  if (auth instanceof NextResponse) return auth;

  const sp = req.nextUrl.searchParams;
  const parsed = parseAnioMes(sp);
  if (parsed instanceof NextResponse) return parsed;
  const { anio, mes } = parsed;

  try {
    const snapshot = await loadSnapshotCabecera(anio, mes);

    // Ya generado → devolver el detalle CONGELADO (no el cálculo en vivo).
    if (snapshot) {
      const { data: det, error } = await getSupabaseServer()
        .from("comisiones_snapshot_recibos")
        .select("fecha,cliente_codigo,cliente_nombre,vendedor_nombre,total,tasa,comision")
        .eq("snapshot_id", snapshot.id)
        .order("fecha", { ascending: true })
        .range(0, 99999);
      if (error) throw new Error(error.message);

      const recibos = (det ?? []).map((r, i) => ({
        id: i, fecha: r.fecha as string | null, cliente_codigo: r.cliente_codigo as string | null,
        cliente_nombre: r.cliente_nombre as string | null, vendedor_id: null,
        vendedor_nombre: r.vendedor_nombre as string | null,
        total: Number(r.total ?? 0), tasa: Number(r.tasa ?? 0), comision: Number(r.comision ?? 0),
      }));

      const agg = new Map<string, VendedorAgregado>();
      for (const r of recibos) {
        const tok = r.vendedor_nombre ?? "(sin vendedor)";
        const e = agg.get(tok) ?? { token: tok, vendedor_id: null, vendedor_nombre: r.vendedor_nombre, num_recibos: 0, total_cobrado: 0, total_comision: 0 };
        e.num_recibos += 1;
        e.total_cobrado = round2(e.total_cobrado + r.total);
        e.total_comision = round2(e.total_comision + r.comision);
        agg.set(tok, e);
      }

      return NextResponse.json({
        anio, mes, frozen: true, esMesEnCurso: esMesEnCurso(anio, mes),
        snapshot: {
          id: snapshot.id, generado_at: snapshot.generado_at, generado_por: snapshot.generado_por,
          total_cobrado: Number(snapshot.total_cobrado), total_comision: Number(snapshot.total_comision),
          vendedores_incluidos: snapshot.vendedores_incluidos, clientes_excluidos: snapshot.clientes_excluidos,
        },
        recibos,
        porVendedor: Array.from(agg.values()).sort((a, b) => b.total_comision - a.total_comision),
        retenciones: [],
        vendedoresDisponibles: [],
        clientesDisponibles: [],
        totalCobrado: Number(snapshot.total_cobrado),
        totalComision: Number(snapshot.total_comision),
      });
    }

    // Cálculo en vivo con filtros.
    const vendedoresSel = sp.get("vendedores") !== null
      ? new Set(sp.get("vendedores")!.split(",").map((s) => s.trim()).filter(Boolean))
      : null;
    const clientesExcl = new Set((sp.get("clientes_excluidos") ?? "").split(",").map((s) => s.trim()).filter(Boolean));

    const recibos = await fetchRecibosMes(anio, mes);
    const calc = calcular(recibos, vendedoresSel, clientesExcl);

    return NextResponse.json({ anio, mes, frozen: false, esMesEnCurso: esMesEnCurso(anio, mes), snapshot: null, ...calc });
  } catch (e) {
    console.error("[comisiones GET]", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = requireRoles(req, ["admin"]);
  if (auth instanceof NextResponse) return auth;
  const role = auth; // role validado
  const session = getSessionPayload(req);

  let body: {
    anio?: number; mes?: number;
    vendedores?: string[]; clientes_excluidos?: string[]; force?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const anio = Number(body.anio);
  const mes = Number(body.mes);
  if (!Number.isInteger(anio) || anio < 2024 || anio > 2100) {
    return NextResponse.json({ error: "anio inválido" }, { status: 400 });
  }
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
    return NextResponse.json({ error: "mes inválido (1..12)" }, { status: 400 });
  }

  const db = getSupabaseServer();

  try {
    // Idempotencia: no regenerar si ya existe (usar DELETE para regenerar).
    const existente = await loadSnapshotCabecera(anio, mes);
    if (existente) {
      return NextResponse.json(
        { error: "Ya existe un cierre de comisiones para este mes. Elimínalo para regenerar." },
        { status: 409 },
      );
    }

    // Mes en curso sin terminar: exige confirmación explícita (force).
    if (esMesEnCurso(anio, mes) && !body.force) {
      return NextResponse.json(
        { error: "El mes aún está en curso. Confirma para generar de todas formas.", needsConfirm: true },
        { status: 409 },
      );
    }

    const vendedoresSel = Array.isArray(body.vendedores)
      ? new Set(body.vendedores.map((s) => String(s).trim()).filter(Boolean))
      : null;
    const clientesExcl = new Set((body.clientes_excluidos ?? []).map((s) => String(s).trim()).filter(Boolean));

    const recibos = await fetchRecibosMes(anio, mes);
    const calc = calcular(recibos, vendedoresSel, clientesExcl);

    // Cabecera.
    const { data: cab, error: cabErr } = await db
      .from("comisiones_snapshot")
      .insert({
        anio, mes,
        vendedores_incluidos: calc.porVendedor.map((v) => ({ token: v.token, id: v.vendedor_id, nombre: v.vendedor_nombre })),
        clientes_excluidos: Array.from(clientesExcl),
        total_cobrado: calc.totalCobrado,
        total_comision: calc.totalComision,
        generado_por: role,
      })
      .select("id")
      .single();
    if (cabErr || !cab) throw new Error(cabErr?.message ?? "no se pudo crear la cabecera");

    // Detalle congelado.
    if (calc.recibos.length > 0) {
      const detalle = calc.recibos.map((r) => ({
        snapshot_id: cab.id,
        fecha: r.fecha, cliente_codigo: r.cliente_codigo, cliente_nombre: r.cliente_nombre,
        vendedor_nombre: r.vendedor_nombre, total: r.total, tasa: r.tasa, comision: r.comision,
      }));
      const { error: detErr } = await db.from("comisiones_snapshot_recibos").insert(detalle);
      if (detErr) {
        // Compensación: borrar la cabecera si el detalle falla (evita snapshot huérfano).
        await db.from("comisiones_snapshot").delete().eq("id", cab.id);
        throw new Error(detErr.message);
      }
    }

    await logActivity(session?.nombre || role, "comisiones_generar", `${anio}-${String(mes).padStart(2, "0")} · $${calc.totalComision}`);

    return NextResponse.json({ ok: true, id: cab.id, total_cobrado: calc.totalCobrado, total_comision: calc.totalComision });
  } catch (e) {
    console.error("[comisiones POST]", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
