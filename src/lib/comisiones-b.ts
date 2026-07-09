// Helpers server-side del módulo Comisiones (compartidos entre el route
// principal y el drill-down de Formato B). Reglas:
//   VENTA B: switch_facturas del mes, vendedor DE LA FACTURA (normalizado).
//     FA suma subtotal_descuento, NC resta ABS (vienen negativas nativas),
//     ND suma. SIN filtro de utilidad. Comisión = ROUND(base × 1%, 2) por mes.
//   COBRO B: switch_recibos del mes, atribución por CARTERA (dueño del cliente:
//     vendedor_cartera persistido → mapa actual → vendedor del recibo), excluye
//     es_retencion. Comisión = ROUND(base × 1%, 2) por mes.
//   Totales = suma de componentes YA redondeados.

import { getSupabaseServer } from "@/lib/supabase-server";
import {
  normalizeVendedor, round2, FORMATO_B_TASA,
  type ReciboRow, type FormatoBVendedor, type FormatoBMes,
} from "@/lib/comisiones";

export function monthBounds(anio: number, mes: number) {
  const inicio = `${anio}-${String(mes).padStart(2, "0")}-01`;
  const ny = mes === 12 ? anio + 1 : anio;
  const nm = mes === 12 ? 1 : mes + 1;
  const finExcl = `${ny}-${String(nm).padStart(2, "0")}-01`;
  return { inicio, finExcl };
}

/** Trae los recibos del mes (todos, incluye retenciones) de switch_recibos. */
export async function fetchRecibosMes(anio: number, mes: number): Promise<ReciboRow[]> {
  const { inicio, finExcl } = monthBounds(anio, mes);
  const { data, error } = await getSupabaseServer()
    .from("switch_recibos")
    .select("id,fecha,cliente_codigo,cliente_nombre,vendedor_id,vendedor_nombre,vendedor_cartera,total,es_retencion")
    .gte("fecha", inicio)
    .lt("fecha", finExcl)
    .order("fecha", { ascending: true })
    .range(0, 99999);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id as number,
    mes,
    fecha: r.fecha as string | null,
    cliente_codigo: r.cliente_codigo as string | null,
    cliente_nombre: r.cliente_nombre as string | null,
    vendedor_id: (r.vendedor_id as number | null) ?? null,
    vendedor_nombre: r.vendedor_nombre as string | null,
    vendedor_cartera: (r.vendedor_cartera as string | null) ?? null,
    total: Number(r.total ?? 0),
    es_retencion: Boolean(r.es_retencion),
  }));
}

export interface FacturaRow {
  mes: number;
  fecha: string | null;
  numero: string | null;
  cliente_nombre: string | null;
  vendedor_nombre: string | null;
  subtotal_descuento: number;
  tipo_comprobante: string;
}

/** Facturas + NC + ND del mes desde switch_facturas (NC vienen negativas nativas). */
export async function fetchFacturasMes(anio: number, mes: number): Promise<FacturaRow[]> {
  const { inicio, finExcl } = monthBounds(anio, mes);
  const { data, error } = await getSupabaseServer()
    .from("switch_facturas")
    .select("fecha,numero,cliente_nombre,vendedor_nombre,subtotal_descuento,tipo_comprobante")
    .gte("fecha", inicio)
    .lt("fecha", finExcl)
    .order("fecha", { ascending: true })
    .range(0, 99999);
  if (error) throw new Error(error.message);
  return (data ?? []).map((f) => ({
    mes,
    fecha: f.fecha as string | null,
    numero: (f.numero as string | null) ?? null,
    cliente_nombre: f.cliente_nombre as string | null,
    vendedor_nombre: f.vendedor_nombre as string | null,
    subtotal_descuento: Number(f.subtotal_descuento ?? 0),
    tipo_comprobante: String(f.tipo_comprobante ?? "Factura"),
  }));
}

/** Vendedores con formato B activo (nombres normalizados). */
export async function loadVendedoresB(): Promise<Set<string>> {
  const { data, error } = await getSupabaseServer()
    .from("comisiones_config_vendedor")
    .select("vendedor_nombre,formato,activo")
    .eq("formato", "B")
    .eq("activo", true);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((r) => normalizeVendedor(r.vendedor_nombre as string)));
}

/** Subtotal FIRMADO de un documento para la base de venta B. */
export function subtotalFirmado(f: { tipo_comprobante: string; subtotal_descuento: number }): number {
  if (f.tipo_comprobante === "Nota de Credito") return -Math.abs(f.subtotal_descuento);
  return f.subtotal_descuento; // Factura y Nota de Debito suman tal cual
}

/** Cartera efectiva de un recibo: columna persistida → mapa actual → vendedor del recibo. */
export function carteraDeRecibo(r: ReciboRow, carteraMap: Map<string, string>): string {
  const persistida = (r.vendedor_cartera ?? "").trim();
  if (persistida) return persistida;
  const codigo = (r.cliente_codigo ?? "").trim();
  const delMapa = codigo ? carteraMap.get(codigo) : undefined;
  return delMapa ?? r.vendedor_nombre ?? "";
}

/**
 * Cálculo Formato B: por vendedor B, bases de venta/cobro POR MES y comisiones
 * (1% fijo, componentes redondeados por mes; el total suma componentes ya
 * redondeados). Devuelve una fila por vendedor B activo aunque esté en cero.
 */
export function calcularFormatoB(
  facturas: FacturaRow[],
  recibos: ReciboRow[],
  vendedoresB: Set<string>,
  carteraMap: Map<string, string>,
  meses: number[],
): FormatoBVendedor[] {
  // vendedor → mes → { ventas, cobros }
  const acc = new Map<string, Map<number, { ventas: number; cobros: number }>>();
  const ensure = (vend: string, mes: number) => {
    if (!acc.has(vend)) acc.set(vend, new Map());
    const porMes = acc.get(vend)!;
    if (!porMes.has(mes)) porMes.set(mes, { ventas: 0, cobros: 0 });
    return porMes.get(mes)!;
  };
  for (const v of Array.from(vendedoresB)) for (const m of meses) ensure(v, m);

  for (const f of facturas) {
    const vend = normalizeVendedor(f.vendedor_nombre);
    if (!vendedoresB.has(vend)) continue;
    ensure(vend, f.mes).ventas += subtotalFirmado(f);
  }
  for (const r of recibos) {
    if (r.es_retencion) continue;
    const vend = normalizeVendedor(carteraDeRecibo(r, carteraMap));
    if (!vendedoresB.has(vend)) continue;
    ensure(vend, r.mes).cobros += r.total;
  }

  const out: FormatoBVendedor[] = [];
  for (const [vendedor, porMesMap] of Array.from(acc.entries())) {
    const porMes: FormatoBMes[] = meses.map((mes) => {
      const e = porMesMap.get(mes) ?? { ventas: 0, cobros: 0 };
      const ventas_base = round2(e.ventas);
      const cobros_base = round2(e.cobros);
      return {
        mes,
        ventas_base,
        cobros_base,
        comision_venta: round2(ventas_base * FORMATO_B_TASA),
        comision_cobro: round2(cobros_base * FORMATO_B_TASA),
      };
    });
    const sum = (k: keyof FormatoBMes) => round2(porMes.reduce((a, m) => a + (m[k] as number), 0));
    const comision_venta = sum("comision_venta");
    const comision_cobro = sum("comision_cobro");
    out.push({
      vendedor,
      porMes,
      ventas_base: sum("ventas_base"),
      cobros_base: sum("cobros_base"),
      comision_venta,
      comision_cobro,
      comision_total: round2(comision_venta + comision_cobro),
    });
  }
  return out.sort((a, b) => b.comision_total - a.comision_total || a.vendedor.localeCompare(b.vendedor));
}
