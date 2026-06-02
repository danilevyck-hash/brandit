import { getSupabaseServer } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { requireRoles } from "@/lib/auth-brandit";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireRoles(request, ["admin"]);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();

  const { data, error } = await getSupabaseServer()
    .from("user_roles")
    .update({ ...body, empresa: "Confecciones Boston" }) // mono-empresa: forzado
    .eq("id", params.id)
    .select()
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
