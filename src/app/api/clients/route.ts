import { supabase } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";
import { requireRoles } from "@/lib/auth-brandit";

export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const auth = requireRoles(req, ["admin", "secretaria", "vendedora"]);
  if (auth instanceof NextResponse) return auth;

  const { data, error } = await supabase
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
  const { data, error } = await supabase
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
  const { id, ...updates } = body;
  const { data, error } = await supabase.from("clients").update(updates).eq("id", id).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const auth = requireRoles(request, ["admin", "secretaria", "vendedora"]);
  if (auth instanceof NextResponse) return auth;

  const { id } = await request.json();
  const { error } = await supabase.from("clients").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
