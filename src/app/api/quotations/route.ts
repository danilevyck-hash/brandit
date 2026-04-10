import { supabase } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");

  if (id) {
    const { data, error } = await supabase
      .from("quotations")
      .select("*, client:clients(*), items:quotation_items(*), print_jobs(*)")
      .eq("id", id)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  const status = request.nextUrl.searchParams.get("status");
  const search = request.nextUrl.searchParams.get("search");

  let query = supabase
    .from("quotations")
    .select("*, client:clients(id, name)")
    .order("date", { ascending: false })
    .order("id", { ascending: false });

  if (status) query = query.eq("status", status);

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let result = data || [];
  if (search) {
    const q = search.toLowerCase();
    result = result.filter(
      (r: Record<string, unknown>) =>
        (r.client as Record<string, unknown>)?.name?.toString().toLowerCase().includes(q) ||
        r.notes?.toString().toLowerCase().includes(q)
    );
  }

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { data, error } = await supabase
    .from("quotations")
    .insert([{
      client_id: body.client_id,
      date: body.date,
      status: body.status || "pendiente",
      notes: body.notes || null,
    }])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { id, ...updates } = body;
  const { data, error } = await supabase.from("quotations").update(updates).eq("id", id).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const { id } = await request.json();
  const { error } = await supabase.from("quotations").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
