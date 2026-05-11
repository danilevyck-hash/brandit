// Cliente Supabase server-side para Apps Familia (Brand It propia,
// proyecto halqekrjfttpwoqtazjm). Usa service_role para bypass de RLS
// en operaciones internas (uploads, admin tasks).
//
// Vive acá: ventas_pipeline_boston, clients, quotations, stickers, leads,
// notas_entrega, user_roles, etc.
//
// Para datos compartidos con fashiongr (ventas_raw, ventas_metas, RPC
// ventas_dashboard_summary, clientes_master, clientes_empresa_12m_vw)
// usar supabase-af.ts.

import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function getSupabaseServer(): SupabaseClient {
  if (!_client) {
    _client = createClient(
      process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return _client;
}
