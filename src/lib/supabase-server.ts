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
    const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url) {
      throw new Error("SUPABASE_URL no configurado (revisar env vars de Vercel)");
    }
    if (!key) {
      // Sin service_role, las escrituras y lecturas con RLS quedan bloqueadas
      // silenciosamente (data=[] sin error visible). Fallar al boot es mejor
      // que tener bugs invisibles en producción.
      throw new Error("SUPABASE_SERVICE_ROLE_KEY no configurado — sin service role no se pueden hacer escrituras ni lecturas con RLS (revisar env vars de Vercel para el proyecto Apps Familia)");
    }
    _client = createClient(url, key);
  }
  return _client;
}
