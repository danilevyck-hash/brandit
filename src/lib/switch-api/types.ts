// Tipos del cliente Switch API — Brand It (single-empresa: Confecciones Boston).
// Reconstruido desde specs del sprint (no copia de fashiongr). Las formas crudas
// del API de Switch se mapean a estos tipos en sync.ts; los nombres de campos
// crudos se confirman contra el API real cuando existan las env vars.

export type TipoComprobante = "Factura" | "Nota de Credito" | "Nota de Debito";

/** Comprobante normalizado, listo para upsert a switch_facturas. */
export interface Factura {
  factura_id: string;
  numero: string;
  fecha: string;                       // YYYY-MM-DD
  cliente_codigo: string | null;
  cliente_nombre: string | null;
  vendedor_codigo: string | null;
  vendedor_nombre: string | null;
  subtotal: number;
  subtotal_descuento: number;          // base pre-impuesto, KEY para reportes
  itbms: number;
  total: number;
  tipo_comprobante: TipoComprobante;
  is_wholesale: boolean;
  sucursal_codigo: string | null;
  raw_data: unknown;                   // payload crudo para debug
}

/** Fila del estado de cuenta (CxC), lista para insert a switch_estadocuenta. */
export interface EstadoCuentaRow {
  cliente_codigo: string;
  cliente_nombre: string | null;
  factura_numero: string | null;
  fecha_emision: string | null;
  fecha_vencimiento: string | null;
  dias_vencido: number | null;
  bucket: string | null;               // '0-30' | '31-60' | ... | '+365'
  saldo: number;
}

export interface Cliente {
  codigo: string;
  nombre: string | null;
}

export interface Vendedor {
  codigo: string;
  nombre: string | null;
}

/** Detalle de un row que se saltó en el sync (nunca descartar en silencio). */
export interface SkipDetail {
  entidad: string;          // 'Factura' | 'Nota de Credito' | 'estadocuenta' | 'costo_diario'
  identificador: string;    // numero / factura_id / cliente_codigo / fecha
  campo: string;            // campo que falló el parseo / faltó
  valorCrudo: string;       // valor crudo que no parseó (para debug)
  motivo: string;
}

export type SyncType = "facturas" | "estadocuenta" | "costo_diario" | "recibos";

export interface SyncResult {
  syncType: SyncType;
  // "partial-cursor": la vuelta de estadocuenta quedó a medias (se acabó el
  // presupuesto de tiempo); hay un cursor activo y falta reanudar. NO se corrió
  // el reconcile final todavía.
  status: "success" | "partial" | "error" | "partial-cursor";
  rowsSynced: number;
  rowsSkipped: number;
  skipDetails: SkipDetail[];
  /** Solo estadocuenta: clientes con saldo neto ~0 (pagados) no insertados. NO son skips ni fallos. */
  excludedNetZero?: number;
  /** Solo estadocuenta: clientes que faltan procesar en la vuelta actual (cuando es partial-cursor). */
  remaining?: number;
  /** Solo estadocuenta: true si esta corrida RETOMÓ un cursor existente (vuelta a medias) en vez de iniciar una nueva. */
  resumed?: boolean;
  errorMessage?: string;
  startedAt: string;        // ISO
  finishedAt: string;       // ISO
}
