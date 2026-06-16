export interface RecordatorioPago {
  id: string;
  cliente: string;
  monto: number | null;
  fecha_prometida: string;
  nota: string | null;
  cumplido: boolean;
  cumplido_at: string | null;
  cumplido_by: string | null;
  created_by: string | null;
  created_at: string;
}
