// Endpoint de lectura para el catálogo canónico de transportistas (Sprint 1).
// Lo consume el form de guías para llenar el select cuando el modo es
// "transportista". Devuelve solo los activos, ordenados por nombre.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { logActivity } from "@/lib/activity-log";
import { requireRoles, getSessionPayload, type Role } from "@/lib/auth-brandit";

const GUIAS_ROLES: readonly Role[] = ["admin", "secretaria"];

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = requireRoles(req, GUIAS_ROLES);
  if (auth instanceof NextResponse) return auth;

  const { data, error } = await getSupabaseServer()
    .from("transportistas")
    .select("id, nombre, activo")
    .eq("activo", true)
    .order("nombre", { ascending: true });

  if (error) {
    console.error("[/api/transportistas] GET error:", error.message);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
  return NextResponse.json(data || []);
}

// Alta de transportista al catálogo desde el "+" del form de guías.
// Idempotente contra UNIQUE(nombre): si ya existe (aunque sea inactivo),
// lo devuelve (reactivándolo) en vez de fallar — el form solo necesita el id.
export async function POST(req: NextRequest) {
  const auth = requireRoles(req, GUIAS_ROLES);
  if (auth instanceof NextResponse) return auth;
  const session = getSessionPayload(req);

  const body = await req.json().catch(() => ({}));
  const nombre = typeof body?.nombre === "string" ? body.nombre.trim() : "";
  if (!nombre) {
    return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  // ¿Ya existe (case-insensitive)? Devolverlo, reactivando si estaba inactivo.
  const { data: existing } = await supabase
    .from("transportistas")
    .select("id, nombre, activo")
    .ilike("nombre", nombre)
    .limit(1)
    .maybeSingle();
  if (existing) {
    if (!existing.activo) {
      await supabase.from("transportistas").update({ activo: true }).eq("id", existing.id);
      existing.activo = true;
    }
    return NextResponse.json(existing);
  }

  const { data, error } = await supabase
    .from("transportistas")
    .insert({ nombre })
    .select("id, nombre, activo")
    .single();

  if (error) {
    // Carrera contra el UNIQUE: recuperar el existente en vez de 500.
    const { data: race } = await supabase
      .from("transportistas")
      .select("id, nombre, activo")
      .ilike("nombre", nombre)
      .limit(1)
      .maybeSingle();
    if (race) return NextResponse.json(race);
    console.error("[/api/transportistas] POST error:", error.message);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }

  await logActivity(session?.nombre || "sistema", "transportista_create", `Transportista "${nombre}" creado`);
  return NextResponse.json(data);
}
