import { getSupabaseServer } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { requireRoles } from "@/lib/auth-brandit";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireRoles(request, ["admin"]);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();

  // SEC-4: allowlist de columnas (anti mass-assignment). El password solo se
  // actualiza si viene explícito y no vacío (el GET ya no lo devuelve, así que un
  // form sin tocarlo NO debe borrar la contraseña existente). No se toca el
  // sistema de passwords: sigue en texto plano por decisión del dueño.
  const updates: Record<string, unknown> = {};
  for (const k of ["email", "role", "nombre", "empresa", "activo"] as const) {
    if (k in body) updates[k] = body[k];
  }
  if (typeof body.password === "string" && body.password.length > 0) {
    updates.password = body.password;
  }

  const { data, error } = await getSupabaseServer()
    .from("user_roles")
    .update(updates)
    .eq("id", params.id)
    .select("id, email, role, nombre, empresa, activo")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireRoles(request, ["admin"]);
  if (auth instanceof NextResponse) return auth;

  const { error } = await getSupabaseServer()
    .from("user_roles")
    .delete()
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
