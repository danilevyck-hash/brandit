export type Transportista = { id: string; nombre: string; activo: boolean };

export type GuiaItem = {
  id?: string;
  orden?: number;
  cliente: string;
  direccion: string;
  facturas: string;
  bultos: number;
  numero_guia_transp: string;
};

export type Guia = {
  id: string;
  numero: number;
  fecha: string;
  modo_entrega: "transportista" | "entrega_directa";
  transportista_id: string | null;
  transportista?: string; // label computado (display)
  placa: string | null;
  nombre_chofer: string | null;
  tipo_despacho: string | null; // 'externo' | 'directo'
  observaciones: string | null;
  monto_total: number;
  estado: string; // 'Pendiente Bodega' | 'Completada' | 'Despachada' | 'Rechazada'
  motivo_rechazo: string | null;
  entregado_por: string | null;
  numero_guia_transp: string | null;
  receptor_nombre: string | null;
  cedula: string | null;
  firma_base64: string | null;
  firma_entregador_base64: string | null;
  deleted: boolean;
  created_at: string;
  guia_items?: GuiaItem[];
  total_bultos?: number;
  item_count?: number;
};

export function fmtGuia(n: number): string {
  return String(n).padStart(5, "0");
}
export function fmtFechaCorta(s: string | null): string {
  if (!s) return "—";
  const d = new Date(`${s}T12:00:00-05:00`);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("es-PA", { timeZone: "America/Panama", day: "numeric", month: "short", year: "numeric" });
}
