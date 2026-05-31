// Tipos del módulo Ventas single-empresa (Boston). Shapes devueltos por los RPCs
// ventas_overview_v1 / ventas_detalle_mensual_v1 / ventas_vendedoras_v1 / ventas_clientes_v1.

export type MesOverview = {
  mes: string;
  ventas: number;
  tickets: number;
  ticketProm: number;
  vs2025: number | null;
  es_periodo_parcial: boolean;
  fecha_corte: string | null;
  dia_corte_anio_anterior: string | null;
};

export type Overview = {
  ytdVentas: number;
  ytdTickets: number;
  ticketProm: number;
  ytdCosto: number;
  ytdUtilidad: number;
  margen: number | null;
  margenPrev: number | null;
  meses: MesOverview[];
};

export type DiaDetalle = {
  dia: number;
  ventas: number;
  utilidad: number | null;
  n_tickets: number;
  ventas_mes_anterior: number;
};

export type DetalleTotales = {
  ventas: number;
  costo: number;
  utilidad: number;
  n_tickets: number;
  ticket_promedio: number;
  margen: number | null;
  proyeccion_cierre: number | null;
};

export type DetalleComparativo = { ventas: number; n_tickets: number; tiene_data: boolean };
export type DiaExtremo = { fecha: string; ventas: number } | null;
export type HeatmapDow = { dow: number; dow_label: string; ventas_promedio: number; count_dias: number };

export type DetalleMensual = {
  year: number;
  mes: number;
  mes_label: string;
  is_mes_actual: boolean;
  dia_actual: number;
  dias_en_mes: number;
  dias: DiaDetalle[];
  totales: DetalleTotales;
  mes_anterior: DetalleComparativo;
  yoy: DetalleComparativo;
  mejor_dia: DiaExtremo;
  peor_dia: DiaExtremo;
  heatmap_dia_semana: HeatmapDow[];
};

export type Vendedora = {
  nombre: string;
  tickets: number;
  ventas: number;
  ticket_promedio: number;
  top: boolean;
  delta_ventas_pct: number | null;
  delta_tickets_pct: number | null;
};

export type VendedorasResp = {
  vendedoras: Vendedora[];
  total_vendedoras_periodo: number;
  ventas_total: number;
  tickets_total: number;
  ventas_total_prev: number;
  tickets_total_prev: number;
  fecha_corte: string | null;
  es_periodo_parcial: boolean;
  dia_corte_anio_anterior: string | null;
};

export type ClienteMes = { mes_anio: number; mes_idx: number; mes_label: string; ventas: number; tickets: number };

export type Cliente = {
  nombre: string;
  total_ytd: number;
  tickets_ytd: number;
  ticket_prom: number;
  ultima_compra: string | null;
  meses: ClienteMes[];
};

export type ClientesResp = {
  fecha_inicio: string;
  fecha_fin: string;
  limit: number;
  total_clientes: number;
  total_ventas: number;
  total_tickets: number;
  clientes: Cliente[];
};
