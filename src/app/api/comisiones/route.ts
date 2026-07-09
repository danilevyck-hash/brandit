// Comisiones (switch_recibos + switch_facturas). Solo admin.
//   GET ?anio=&mes=  o  ?anio=&meses=1,2,3 [&vendedores=&clientes_excluidos=]
//       Un solo mes → cálculo en vivo (o el snapshot congelado si ya existe).
//       Varios meses → SIEMPRE cálculo en vivo combinado (los cierres son
//       mensuales); mesesConCierre informa cuáles ya tienen snapshot.
//   POST → genera snapshot del mes (cabecera + detalle A+B), idempotente por (anio, mes).
//
// DOS formatos, asignados por vendedor en comisiones_config_vendedor:
//   A (por recibo): tramos fijos (<15000 → 0.5%, >=15000 → 1%), atribución por
//     vendedor del recibo, excluye es_retencion. Los vendedores B NO aparecen acá.
//   B (venta + cobro, estilo fashiongr): VENTA = switch_facturas del mes por
//     vendedor de la factura (FA + subtotal_descuento, NC −ABS, ND +), SIN filtro
//     de utilidad, × 1%. COBRO = recibos por CARTERA (dueño del cliente), excluye
//     es_retencion, × 1%. Total = componentes ya redondeados. Nombres comparados
//     normalizados (fusiona "MELCHOR VEGA"/"Melchor Vega").

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { logActivity } from "@/lib/activity-log";
import { requireRoles, getSessionPayload } from "@/lib/auth-brandit";
import { loadCarteraMap } from "@/lib/switch-api/sync-clientes-cartera";
import {
  comisionRecibo, tasaPara, vendedorToken, round2,
  normalizeVendedor, tipoDocCorto, FORMATO_B_TASA,
  type ReciboRow, type ReciboCalculado, type VendedorAgregado,
  type FormatoBVendedor,
} from "@/lib/comisiones";
import {
  fetchRecibosMes, fetchFacturasMes, loadVendedoresB,
  subtotalFirmado, carteraDeRecibo, calcularFormatoB,
  type FacturaRow,
} from "@/lib/comisiones-b";

export const dynamic = "force-dynamic";

function esMesEnCurso(anio: number, mes: number): boolean {
  const d = new Date();
  return anio === d.getUTCFullYear() && mes === d.getUTCMonth() + 1;
}

function parseAnioMeses(sp: URLSearchParams): { anio: number; meses: number[] } | NextResponse {
  const anio = parseInt(sp.get("anio") ?? "", 10);
  if (!Number.isInteger(anio) || anio < 2024 || anio > 2100) {
    return NextResponse.json({ error: "anio inválido" }, { status: 400 });
  }
  // `meses=1,2,3` (lista) tiene prioridad; `mes=` se mantiene por compatibilidad.
  const raw = sp.get("meses") ?? sp.get("mes") ?? "";
  const meses = Array.from(new Set(
    raw.split(",").map((s) => parseInt(s.trim(), 10)),
  )).sort((a, b) => a - b);
  if (meses.length === 0 || meses.some((m) => !Number.isInteger(m) || m < 1 || m > 12)) {
    return NextResponse.json({ error: "mes inválido (1..12)" }, { status: 400 });
  }
  return { anio, meses };
}

// (fetchRecibosMes / fetchFacturasMes / loadVendedoresB / calcularFormatoB y
// helpers de Formato B viven en @/lib/comisiones-b, compartidos con detalle-b.)

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
    id: r.id, mes: r.mes, fecha: r.fecha, cliente_codigo: r.cliente_codigo, cliente_nombre: r.cliente_nombre,
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
  const parsed = parseAnioMeses(sp);
  if (parsed instanceof NextResponse) return parsed;
  const { anio, meses } = parsed;
  const mes = meses[0];

  try {
    // Solo el modo de UN mes puede devolver un snapshot congelado; con varios
    // meses el cálculo es siempre en vivo (los cierres son mensuales).
    const snapshot = meses.length === 1 ? await loadSnapshotCabecera(anio, mes) : null;

    // Ya generado → devolver el detalle CONGELADO (no el cálculo en vivo).
    if (snapshot) {
      const { data: det, error } = await getSupabaseServer()
        .from("comisiones_snapshot_recibos")
        .select("fecha,cliente_codigo,cliente_nombre,vendedor_nombre,total,tasa,comision,formato,seccion")
        .eq("snapshot_id", snapshot.id)
        .order("fecha", { ascending: true })
        .range(0, 99999);
      if (error) throw new Error(error.message);

      const rows = det ?? [];
      const recibos = rows
        .filter((r) => (r.formato ?? "A") === "A")
        .map((r, i) => ({
          id: i, mes, fecha: r.fecha as string | null, cliente_codigo: r.cliente_codigo as string | null,
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

      // Formato B congelado: reconstruir el resumen desde las filas B del detalle
      // (bases = Σ montos por sección; comisión = base × 1%, igual que al generar).
      const bAcc = new Map<string, { ventas: number; cobros: number }>();
      for (const r of rows) {
        if ((r.formato ?? "A") !== "B") continue;
        const vend = normalizeVendedor(r.vendedor_nombre as string);
        const e = bAcc.get(vend) ?? { ventas: 0, cobros: 0 };
        if ((r.seccion ?? "cobro") === "venta") e.ventas += Number(r.total ?? 0);
        else e.cobros += Number(r.total ?? 0);
        bAcc.set(vend, e);
      }
      const formatoB: FormatoBVendedor[] = Array.from(bAcc.entries()).map(([vendedor, e]) => {
        const ventas_base = round2(e.ventas);
        const cobros_base = round2(e.cobros);
        const comision_venta = round2(ventas_base * FORMATO_B_TASA);
        const comision_cobro = round2(cobros_base * FORMATO_B_TASA);
        return {
          vendedor, porMes: [{ mes, ventas_base, cobros_base, comision_venta, comision_cobro }],
          ventas_base, cobros_base, comision_venta, comision_cobro,
          comision_total: round2(comision_venta + comision_cobro),
        };
      }).sort((a, b) => b.comision_total - a.comision_total || a.vendedor.localeCompare(b.vendedor));

      return NextResponse.json({
        anio, mes, meses, mesesConCierre: [mes], frozen: true, esMesEnCurso: esMesEnCurso(anio, mes),
        formatoB,
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

    // Cálculo en vivo con filtros (uno o varios meses combinados).
    const vendedoresSel = sp.get("vendedores") !== null
      ? new Set(sp.get("vendedores")!.split(",").map((s) => s.trim()).filter(Boolean))
      : null;
    const clientesExcl = new Set((sp.get("clientes_excluidos") ?? "").split(",").map((s) => s.trim()).filter(Boolean));

    const vendedoresB = await loadVendedoresB();
    const [porMes, facturasPorMes, carteraMap] = await Promise.all([
      Promise.all(meses.map((m) => fetchRecibosMes(anio, m))),
      vendedoresB.size > 0
        ? Promise.all(meses.map((m) => fetchFacturasMes(anio, m)))
        : Promise.resolve([] as FacturaRow[][]),
      vendedoresB.size > 0 ? loadCarteraMap() : Promise.resolve(new Map<string, string>()),
    ]);
    const recibos = porMes.flat();

    // Formato A: SOLO recibos de vendedores que no son B (por vendedor del recibo).
    const recibosA = recibos.filter((r) => !vendedoresB.has(normalizeVendedor(r.vendedor_nombre)));
    const calc = calcular(recibosA, vendedoresSel, clientesExcl);

    // Formato B: ventas por vendedor de factura + cobros por cartera.
    const formatoB = calcularFormatoB(facturasPorMes.flat(), recibos, vendedoresB, carteraMap, meses);

    // Con varios meses: informar cuáles ya tienen cierre (la vista combinada no lo usa como fuente).
    let mesesConCierre: number[] = [];
    if (meses.length > 1) {
      const { data: snaps, error: snapsErr } = await getSupabaseServer()
        .from("comisiones_snapshot")
        .select("mes")
        .eq("anio", anio)
        .in("mes", meses);
      if (snapsErr) throw new Error(snapsErr.message);
      mesesConCierre = (snaps ?? []).map((s) => s.mes as number).sort((a, b) => a - b);
    }

    return NextResponse.json({
      anio, mes, meses, mesesConCierre, frozen: false,
      esMesEnCurso: meses.some((m) => esMesEnCurso(anio, m)),
      snapshot: null, formatoB, ...calc,
    });
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

    const vendedoresB = await loadVendedoresB();
    const [recibos, facturas, carteraMap] = await Promise.all([
      fetchRecibosMes(anio, mes),
      vendedoresB.size > 0 ? fetchFacturasMes(anio, mes) : Promise.resolve([] as FacturaRow[]),
      vendedoresB.size > 0 ? loadCarteraMap() : Promise.resolve(new Map<string, string>()),
    ]);

    // Formato A (sin los vendedores B) con los filtros de la vista.
    const recibosA = recibos.filter((r) => !vendedoresB.has(normalizeVendedor(r.vendedor_nombre)));
    const calc = calcular(recibosA, vendedoresSel, clientesExcl);

    // Formato B (resumen + líneas del detalle congelado).
    const formatoB = calcularFormatoB(facturas, recibos, vendedoresB, carteraMap, [mes]);
    const bCobrosBase = round2(formatoB.reduce((a, v) => a + v.cobros_base, 0));
    const bComisionTotal = round2(formatoB.reduce((a, v) => a + v.comision_total, 0));

    const detalleB: Record<string, unknown>[] = [];
    for (const f of facturas) {
      const vend = normalizeVendedor(f.vendedor_nombre);
      if (!vendedoresB.has(vend)) continue;
      const firmado = round2(subtotalFirmado(f));
      detalleB.push({
        fecha: f.fecha, cliente_codigo: null, cliente_nombre: f.cliente_nombre,
        vendedor_nombre: vend, total: firmado, tasa: FORMATO_B_TASA,
        comision: round2(firmado * FORMATO_B_TASA), // informativa: el cierre se calcula sobre la BASE
        formato: "B", seccion: "venta",
        tipo_doc: tipoDocCorto(f.tipo_comprobante), numero_doc: f.numero,
      });
    }
    for (const r of recibos) {
      if (r.es_retencion) continue;
      const vend = normalizeVendedor(carteraDeRecibo(r, carteraMap));
      if (!vendedoresB.has(vend)) continue;
      detalleB.push({
        fecha: r.fecha, cliente_codigo: r.cliente_codigo, cliente_nombre: r.cliente_nombre,
        vendedor_nombre: vend, total: round2(r.total), tasa: FORMATO_B_TASA,
        comision: round2(round2(r.total) * FORMATO_B_TASA),
        formato: "B", seccion: "cobro", tipo_doc: null, numero_doc: null,
      });
    }

    // Cabecera: totales del mes = A + B (cobrado real; la base de venta B vive en el detalle).
    const { data: cab, error: cabErr } = await db
      .from("comisiones_snapshot")
      .insert({
        anio, mes,
        vendedores_incluidos: [
          ...calc.porVendedor.map((v) => ({ token: v.token, id: v.vendedor_id, nombre: v.vendedor_nombre, formato: "A" })),
          ...formatoB.map((v) => ({ nombre: v.vendedor, formato: "B" })),
        ],
        clientes_excluidos: Array.from(clientesExcl),
        total_cobrado: round2(calc.totalCobrado + bCobrosBase),
        total_comision: round2(calc.totalComision + bComisionTotal),
        generado_por: role,
      })
      .select("id")
      .single();
    if (cabErr || !cab) throw new Error(cabErr?.message ?? "no se pudo crear la cabecera");

    // Detalle congelado (A + B).
    const detalle = [
      ...calc.recibos.map((r) => ({
        snapshot_id: cab.id,
        fecha: r.fecha, cliente_codigo: r.cliente_codigo, cliente_nombre: r.cliente_nombre,
        vendedor_nombre: r.vendedor_nombre, total: r.total, tasa: r.tasa, comision: r.comision,
        formato: "A", seccion: "cobro", tipo_doc: null, numero_doc: null,
      })),
      ...detalleB.map((d) => ({ ...d, snapshot_id: cab.id })),
    ];
    if (detalle.length > 0) {
      const INSERT_BATCH = 500;
      for (let i = 0; i < detalle.length; i += INSERT_BATCH) {
        const { error: detErr } = await db
          .from("comisiones_snapshot_recibos")
          .insert(detalle.slice(i, i + INSERT_BATCH));
        if (detErr) {
          // Compensación: borrar la cabecera si el detalle falla (evita snapshot
          // huérfano; el detalle ya insertado cae por ON DELETE CASCADE).
          await db.from("comisiones_snapshot").delete().eq("id", cab.id);
          throw new Error(detErr.message);
        }
      }
    }

    const totalComisionMes = round2(calc.totalComision + bComisionTotal);
    await logActivity(session?.nombre || role, "comisiones_generar", `${anio}-${String(mes).padStart(2, "0")} · $${totalComisionMes}`);

    return NextResponse.json({
      ok: true, id: cab.id,
      total_cobrado: round2(calc.totalCobrado + bCobrosBase),
      total_comision: totalComisionMes,
    });
  } catch (e) {
    console.error("[comisiones POST]", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
