import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function getSupabaseAF(): SupabaseClient {
  if (!_client) {
    _client = createClient(
      process.env.APPS_FAMILIA_SUPABASE_URL!,
      process.env.APPS_FAMILIA_SUPABASE_ANON_KEY!
    );
  }
  return _client;
}
