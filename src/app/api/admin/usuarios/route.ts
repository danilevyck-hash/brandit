import { getSupabaseAF } from "@/lib/supabase-af";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await getSupabaseAF()
    .from("user_roles")
    .select("*")
    .order("nombre");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const { data, error } = await getSupabaseAF()
    .from("user_roles")
    .insert([{
      email: body.email,
      role: body.role,
      nombre: body.nombre,
      password: body.password,
      empresa: body.empresa,
      activo: body.activo ?? true,
    }])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
