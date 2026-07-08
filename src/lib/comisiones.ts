// Lógica de comisión por COBRO (recibos) — Boston. Tramos FIJOS por recibo,
// NO configurables (sin tabla de tasas):
//   total <  $15,000 → 0.5%
//   total >= $15,000 → 1.0%
// Comisión del recibo = round(total * tasa, 2). El total del mes = suma de las
// comisiones por recibo (no se recalcula sobre el agregado).

export const TRAMO_UMBRAL = 15000;
export const TASA_BAJA = 0.005; // < umbral
export const TASA_ALTA = 0.01;  // >= umbral

/** Tasa (decimal) que aplica a un recibo según su total. */
export function tasaPara(total: number): number {
  return total >= TRAMO_UMBRAL ? TASA_ALTA : TASA_BAJA;
}

/** Comisión de un recibo, redondeada a 2 decimales. */
export function comisionRecibo(total: number): number {
  return Math.round(total * tasaPara(total) * 100) / 100;
}

/** Token estable de un vendedor para selección/agrupación (id o nombre si no hay id). */
export function vendedorToken(vendedorId: number | null, vendedorNombre: string | null): string {
  if (vendedorId != null) return String(vendedorId);
  return `nom:${(vendedorNombre ?? "").trim().toUpperCase()}`;
}

export interface ReciboRow {
  id: number;
  fecha: string | null;
  cliente_codigo: string | null;
  cliente_nombre: string | null;
  vendedor_id: number | null;
  vendedor_nombre: string | null;
  total: number;
  es_retencion: boolean;
}

export interface ReciboCalculado {
  id: number;
  fecha: string | null;
  cliente_codigo: string | null;
  cliente_nombre: string | null;
  vendedor_id: number | null;
  vendedor_nombre: string | null;
  total: number;
  tasa: number;
  comision: number;
}

export interface VendedorAgregado {
  token: string;
  vendedor_id: number | null;
  vendedor_nombre: string | null;
  num_recibos: number;
  total_cobrado: number;
  total_comision: number;
}

/** Redondeo defensivo a 2 decimales (evita ruido de coma flotante en sumas). */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
