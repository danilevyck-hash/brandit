// Server-side fetchers para el módulo Ventas — Brand It (Boston).
//
// Usa la Supabase compartida con fashiongr (APPS_FAMILIA) via supabase-af.
// Todas las queries filtran hardcoded por empresa = 'confecciones_boston'.

import { getSupabaseAF } from "@/lib/supabase-af";
import { getSupabaseServer } from "@/lib/supabase-server";
import { formatDate } from "@/lib/format";
import type {
  VentasResumen,
  Clientes,
  MonthlySeries,
  Vendedora,
  FunnelStats,
} from "@/components/ventas/types";

const COMPANY_KEY = "confecciones_boston";
/** Display name usado en ventas_metas (no normalizado como ventas_raw). */
const META_EMPRESA_DISPLAY = "Confecciones Boston";

interface DashboardSummaryRow {
  empresa: string;
  mes: number;
  total_subtotal: number | string;
  total_costo: number | string;
  total_utilidad: number | string;
  total_facturado: number | string;
  filas: number;
}

function toNum(v: number | string | null | undefined): number {
  return typeof v === "number" ? v : Number(v ?? 0) || 0;
}

// ─── Resumen ─────────────────────────────────────────────────────────────────

/**
 * Resumen tab — KPIs + monthly arrays + funnel + vendedoras del mes.
 *
 * Llama 3 RPCs/queries en paralelo:
 *   - ventas_dashboard_summary(year)   → Boston row only
 *   - ventas_dashboard_summary(year-1) → Boston row only (mismo período)
 *   - ventas_metas WHERE empresa = 'Confecciones Boston' AND anio = year
 *
 * Plus 2 queries simples para funnel + vendedoras.
 */
export async function fetchVentasResumen({ year }: { year: number }): Promise<VentasResumen> {
  const db = getSupabaseAF();

  const [curRes, prevRes, metaRes] = await Promise.all([
    db.rpc("ventas_dashboard_summary", { p_anio: year }),
    db.rpc("ventas_dashboard_summary", { p_anio: year - 1 }),
    db.from("ventas_metas").select("meta").eq("empresa", META_EMPRESA_DISPLAY).eq("anio", year).maybeSingle(),
  ]);

  if (curRes.error) throw new Error(`ventas_dashboard_summary(${year}): ${curRes.error.message}`);
  if (prevRes.error) throw new Error(`ventas_dashboard_summary(${year - 1}): ${prevRes.error.message}`);

  const cur  = ((curRes.data  as DashboardSummaryRow[] | null) ?? []).filter(r => r.empresa === COMPANY_KEY);
  const prev = ((prevRes.data as DashboardSummaryRow[] | null) ?? []).filter(r => r.empresa === COMPANY_KEY);

  const metaAnual = toNum(metaRes.data?.meta);

  // Build monthly arrays (12 elements, null si mes sin data)
  const buildSeries = (rows: DashboardSummaryRow[], field: "total_subtotal" | "total_utilidad" | "total_costo"): MonthlySeries => {
    const arr: MonthlySeries = Array(12).fill(null);
    for (const r of rows) {
      if (r.mes < 1 || r.mes > 12) continue;
      arr[r.mes - 1] = toNum(r[field]);
    }
    return arr;
  };

  const ventas2026   = buildSeries(cur,  "total_subtotal");
  const utilidad2026 = buildSeries(cur,  "total_utilidad");
  const costo2026    = buildSeries(cur,  "total_costo");
  const ventas2025   = buildSeries(prev, "total_subtotal");
  const utilidad2025 = buildSeries(prev, "total_utilidad");
  const costo2025    = buildSeries(prev, "total_costo");

  // mesActual: último mes con data en el año en curso
  let mesActual = 0;
  for (let i = 0; i < 12; i++) {
    if (ventas2026[i] != null && i + 1 > mesActual) mesActual = i + 1;
  }
  const upTo = Math.max(mesActual, 1);

  // Totales YTD absolutos
  const sumYTD = (a: MonthlySeries) => a.reduce<number>((s, v) => s + (v ?? 0), 0);
  const sumSlice = (a: MonthlySeries, n: number) =>
    a.slice(0, n).reduce<number>((s, v) => s + (v ?? 0), 0);

  const ventasYTD      = sumYTD(ventas2026);
  const ventasPrevYTD  = sumSlice(ventas2025, upTo);
  const utilidadYTD    = sumYTD(utilidad2026);
  const utilidadPrevYTD = sumSlice(utilidad2025, upTo);

  // Margen filtered: sólo meses con costo > 0 (excluye ajustes contables)
  const sumFiltered = (vals: MonthlySeries, costo: MonthlySeries, limit = 12): number => {
    let s = 0;
    for (let i = 0; i < Math.min(limit, vals.length); i++) {
      const c = costo[i];
      if (c != null && c > 0) s += vals[i] ?? 0;
    }
    return s;
  };
  const fVCur = sumFiltered(ventas2026, costo2026);
  const fUCur = sumFiltered(utilidad2026, costo2026);
  const fVPrev = sumFiltered(ventas2025, costo2025, upTo);
  const fUPrev = sumFiltered(utilidad2025, costo2025, upTo);
  const margenYTD     = fVCur  > 0 ? fUCur  / fVCur  : 0;
  const margenPrevYTD = fVPrev > 0 ? fUPrev / fVPrev : 0;

  // ─── Funnel (cotizaciones + pedidos de ventas_pipeline_boston + facturas
  //              de ventas_raw, todo del year) ────────────────────────────
  const funnel = await fetchFunnel(year);

  // ─── Vendedoras del mes ──────────────────────────────────────────────────
  const vendedoras = mesActual > 0
    ? await fetchVendedoras(year, mesActual)
    : [];

  return {
    year,
    mesActual,
    kpis: {
      ventasYTD, ventasPrevYTD,
      utilidadYTD, utilidadPrevYTD,
      margenYTD, margenPrevYTD,
      metaAnual,
    },
    ventas2026, ventas2025, utilidad2026, utilidad2025,
    funnel,
    vendedoras,
  };
}

async function fetchFunnel(year: number): Promise<FunnelStats> {
  // CROSS-PROJECT: ventas_pipeline_boston vive en Apps Familia (Brand It
  // propia, supabase-server), mientras que ventas_raw vive en fashion-group
  // (supabase-af). Cero JOINs cross-project — dos queries paralelas y merge
  // en JS.
  const local = getSupabaseServer();
  const af    = getSupabaseAF();

  const [cotRes, pedRes, facRes] = await Promise.all([
    local.from("ventas_pipeline_boston")
      .select("total")
      .eq("empresa", COMPANY_KEY)
      .eq("tipo", "Cotizacion")
      .eq("anio", year),
    local.from("ventas_pipeline_boston")
      .select("total")
      .eq("empresa", COMPANY_KEY)
      .eq("tipo", "Pedido")
      .eq("anio", year),
    // Facturas de ventas_raw (fashion-group) — count distinct n_sistema
    // en JS porque supabase-js no expone count(distinct) directo.
    af.from("ventas_raw")
      .select("subtotal, n_sistema")
      .eq("empresa", COMPANY_KEY)
      .eq("tipo", "Factura")
      .eq("anio", year),
  ]);

  const cotTotal = (cotRes.data ?? []).reduce((s, r) => s + toNum(r.total), 0);
  const pedTotal = (pedRes.data ?? []).reduce((s, r) => s + toNum(r.total), 0);

  // Facturas: distinct n_sistema para count real (una factura puede tener
  // múltiples filas si tiene items, pero ventas_raw es por documento así
  // que count(*) ≈ count(distinct n_sistema). Usamos count distinct por seguridad.
  const facRows = facRes.data ?? [];
  const facCountDistinct = new Set(facRows.map(r => r.n_sistema).filter(Boolean)).size;
  const facTotal = facRows.reduce((s, r) => s + toNum(r.subtotal), 0);

  return {
    cotizaciones: { count: cotRes.data?.length ?? 0, total: cotTotal },
    pedidos:      { count: pedRes.data?.length ?? 0, total: pedTotal },
    facturas:     { count: facCountDistinct, total: facTotal },
  };
}

async function fetchVendedoras(year: number, mes: number): Promise<Vendedora[]> {
  const db = getSupabaseAF();
  // Group by vendedor para el mes. Una venta = un n_sistema distinto.
  const { data, error } = await db
    .from("ventas_raw")
    .select("vendedor, n_sistema, subtotal")
    .eq("empresa", COMPANY_KEY)
    .eq("tipo", "Factura")
    .eq("anio", year)
    .eq("mes", mes);

  if (error || !data) return [];

  const map = new Map<string, { tickets: Set<string>; ventas: number }>();
  for (const r of data) {
    const v = (r.vendedor ?? "").trim();
    if (!v || v.toUpperCase() === "DEFAULT") continue; // DEFAULT no es persona
    const entry = map.get(v) ?? { tickets: new Set<string>(), ventas: 0 };
    if (r.n_sistema) entry.tickets.add(r.n_sistema);
    entry.ventas += toNum(r.subtotal);
    map.set(v, entry);
  }

  return Array.from(map.entries())
    .map(([nombre, e]) => ({
      nombre,
      tickets: e.tickets.size,
      ventas: e.ventas,
      ticketProm: e.tickets.size > 0 ? e.ventas / e.tickets.size : 0,
    }))
    .sort((a, b) => b.ventas - a.ventas);
}

// ─── Available years ─────────────────────────────────────────────────────────

export async function fetchAvailableYears(): Promise<number[]> {
  const db = getSupabaseAF();
  const [minRes, maxRes] = await Promise.all([
    db.from("ventas_raw").select("anio").eq("empresa", COMPANY_KEY).order("anio", { ascending: true }).limit(1),
    db.from("ventas_raw").select("anio").eq("empresa", COMPANY_KEY).order("anio", { ascending: false }).limit(1),
  ]);
  const minY = (minRes.data?.[0]?.anio as number | undefined) ?? null;
  const maxY = (maxRes.data?.[0]?.anio as number | undefined) ?? null;
  const years = new Set<number>();
  if (minY && maxY) for (let y = minY; y <= maxY; y++) years.add(y);
  years.add(new Date().getFullYear());
  return Array.from(years).sort((a, b) => b - a);
}

// ─── Clientes 12m rolling ────────────────────────────────────────────────────

interface ClientesEmpresaRow {
  cliente_id: string | null;
  cliente_nombre: string | null;
  cliente_codigo: string | null;
  empresa: string | null;
  compras_ytd: number | string;
  compras_anio_anterior: number | string;
  delta_vs_2025: number | string | null;
  ultima_compra: string | null;
  whatsapp: string | null;
}

function normalizeWa(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("507")) return "+" + digits;
  if (digits.length === 8) return "+507" + digits;
  return "+" + digits;
}

/**
 * Clientes tab — siempre Boston. Lee de clientes_empresa_12m_vw filtrando
 * por empresa = 'confecciones_boston'. Cada cliente Boston aparece una vez
 * (porque cliente_empresa_12m_vw es granularidad (cliente, empresa) y aquí
 * filtramos a una sola empresa).
 */
export async function fetchClientes({ year: _year }: { year: number }): Promise<Clientes> {
  void _year;
  const db = getSupabaseAF();

  const { data, error } = await db
    .from("clientes_empresa_12m_vw")
    .select("*")
    .eq("empresa", COMPANY_KEY)
    .order("ultima_compra", { ascending: false, nullsFirst: false })
    .limit(5000);

  if (error) throw new Error(`clientes_empresa_12m_vw(${COMPANY_KEY}): ${error.message}`);

  const rows = ((data as ClientesEmpresaRow[] | null) ?? []).map((r, i) => ({
    rank: i + 1,
    id: r.cliente_codigo ?? "—",
    nombre: r.cliente_nombre ?? "(Sin nombre)",
    ytd: toNum(r.compras_ytd),
    prev: toNum(r.compras_anio_anterior),
    delta: r.delta_vs_2025 == null ? 0 : toNum(r.delta_vs_2025),
    ultima: r.ultima_compra ? formatDate(r.ultima_compra) : "",
    ultimaIso: r.ultima_compra ?? "",
    wa: r.whatsapp ? normalizeWa(r.whatsapp) : "",
    isOrphan: r.cliente_id == null,
  }));

  return { total: rows.length, pageSize: rows.length, rows };
}
