import { getSupabaseAF } from "@/lib/supabase-af";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const { data, error } = await getSupabaseAF()
    .from("lead_comentarios")
    .select("*")
    .eq("lead_id", params.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json();

  const { data, error } = await getSupabaseAF()
    .from("lead_comentarios")
    .insert([{
      lead_id: params.id,
      comentario: body.comentario,
      autor: body.autor,
    }])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
