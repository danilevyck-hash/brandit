// Domain types del módulo Ventas — Brand It (single-empresa Boston).
// Simplificado vs fashiongr: sin EmpresaId/Empresa (siempre Boston),
// sin tabs Multifashion, sin breakdown cross-empresa.

/** 12-element array; null = mes sin data (futuro o sin uploads). */
export type MonthlySeries = (number | null)[];

export type ResumenKpis = {
  ventasYTD: number;
  /** Ventas YTD del año previo, mismo período (Ene..mesActual). */
  ventasPrevYTD: number;
  utilidadYTD: number;
  utilidadPrevYTD: number;
  /** Margen YTD real, filtrado por costo > 0 (excluye ajustes contables). */
  margenYTD: number;
  margenPrevYTD: number;
  /** Meta anual de Boston cargada en ventas_metas. Default 0 si no existe. */
  metaAnual: number;
};

/** Card funnel: count + monto total del período (año actual). */
export type FunnelStats = {
  cotizaciones: { count: number; total: number };
  pedidos:      { count: number; total: number };
  facturas:     { count: number; total: number };
};

/** Vendedora del mes — sin comisión por ahora (Daniel decide la fórmula después). */
export type Vendedora = {
  nombre: string;
  tickets: number;
  ventas: number;
  /** ticket promedio del mes (ventas / tickets) */
  ticketProm: number;
};

export type VentasResumen = {
  year: number;
  /** Último mes con data en el año actual (1-12, 0 si no hay data). */
  mesActual: number;
  kpis: ResumenKpis;
  /** Series mensuales para tabla heatmap y toggle Ventas/Utilidad. */
  ventas2026: MonthlySeries;
  ventas2025: MonthlySeries;
  utilidad2026: MonthlySeries;
  utilidad2025: MonthlySeries;
  funnel: FunnelStats;
  /** Vendedoras del mes (mesActual del year). */
  vendedoras: Vendedora[];
};

export type Cliente = {
  rank: number;
  /** Código D-XX de clientes_master o "—" si huérfano. */
  id: string;
  nombre: string;
  ytd: number;
  /** Compras del año previo (mismo período YTD), usado para agregaciones. */
  prev: number;
  /** Δ vs año previo como ratio: 0.18 = +18% */
  delta: number;
  /** "27 abr 2026" */
  ultima: string;
  /** ISO date para sort; "" si sin compras. */
  ultimaIso: string;
  /** E.164, "+50760001111" */
  wa: string;
  /** true cuando cliente_id IS NULL (no match en clientes_master). */
  isOrphan: boolean;
};

export type Clientes = {
  total: number;
  pageSize: number;
  rows: Cliente[];
};
