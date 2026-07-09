import { getSupabaseServer } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { requireRoles } from "@/lib/auth-brandit";

export const dynamic = "force-dynamic";

// SEC-4: solo estas columnas se aceptan en el update (anti mass-assignment).
const CLIENT_FIELDS = ["name", "phone", "email", "notes"] as const;
function pickClientFields(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of CLIENT_FIELDS) if (k in body) out[k] = body[k];
  return out;
}

export async function GET(req: NextRequest) {
  const auth = requireRoles(req, ["admin", "secretaria", "vendedora"]);
  if (auth instanceof NextResponse) return auth;

  const { data, error } = await getSupabaseServer()
    .from("clients")
    .select("*")
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const auth = requireRoles(request, ["admin", "secretaria", "vendedora"]);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const { data, error } = await getSupabaseServer()
    .from("clients")
    .insert([{ name: body.name, phone: body.phone || null, email: body.email || null, notes: body.notes || null }])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(request: NextRequest) {
  const auth = requireRoles(request, ["admin", "secretaria", "vendedora"]);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const { id } = body;
  const updates = pickClientFields(body);
  const { data, error } = await getSupabaseServer().from("clients").update(updates).eq("id", id).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  // SEC-5: borrado destructivo solo admin/secretaria (no vendedora).
  const auth = requireRoles(request, ["admin", "secretaria"]);
  if (auth instanceof NextResponse) return auth;

  const { id } = await request.json();
  const { error } = await getSupabaseServer().from("clients").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
