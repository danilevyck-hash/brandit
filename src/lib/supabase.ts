import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return _client;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getClient() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export type Client = {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
  created_at?: string;
};

export type Quotation = {
  id: number;
  client_id: number | null;
  date: string;
  status: "pendiente" | "aprobado" | "entregado" | "cancelado";
  notes?: string;
  created_at?: string;
  client?: Client;
  items?: QuotationItem[];
  print_jobs?: PrintJob[];
};

export type QuotationItem = {
  id: number;
  quotation_id: number;
  description: string;
  size_color?: string;
  quantity: number;
  fabric_qty: number;
  fabric_price: number;
  lining_qty: number;
  lining_price: number;
  thread_qty: number;
  thread_price: number;
  buttons_qty: number;
  buttons_price: number;
  packaging_qty: number;
  packaging_price: number;
  labor_cost: number;
  seamstress?: string;
  sale_price: number;
  created_at?: string;
};

export type PrintJob = {
  id: number;
  quotation_id: number;
  description: string;
  ink_cost: number;
  paper_cost: number;
  yard_price: number;
  yards_qty: number;
  design_size?: string;
  design_qty: number;
  design_unit_price: number;
  notes?: string;
  created_at?: string;
};

export const QUOTATION_STATUSES = [
  { value: "pendiente", label: "Pendiente", color: "#F39C12" },
  { value: "aprobado", label: "Aprobado", color: "#2ECC71" },
  { value: "entregado", label: "Entregado", color: "#3498DB" },
  { value: "cancelado", label: "Cancelado", color: "#E74C3C" },
] as const;
