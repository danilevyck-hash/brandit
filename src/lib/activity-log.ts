import { getSupabaseAF } from "./supabase-af";

export async function logActivity(usuario: string, accion: string, detalle?: string) {
  try {
    await getSupabaseAF()
      .from("activity_log")
      .insert([{ usuario, accion, detalle: detalle || null }]);
  } catch {
    // Never block the main flow if logging fails
  }
}
