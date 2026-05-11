// Cliente Supabase server-side único de Brand It — apunta a Apps Familia
// (proyecto halqekrjfttpwoqtazjm). Usa service_role para bypass de RLS
// en operaciones internas (uploads, admin tasks, RPCs).
//
// Brand It es 100% independiente: cero cross-project. Todo el ERP (ventas_raw,
// ventas_metas, cxc_*, clientes_master, clientes_empresa_12m_vw, RPCs) y todas
// las tablas internas (user_roles, clients, leads, etc.) viven en Apps Familia.

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
