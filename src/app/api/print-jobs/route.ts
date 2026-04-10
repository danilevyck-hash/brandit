import { supabase } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const quotationId = request.nextUrl.searchParams.get("quotation_id");
  if (!quotationId) return NextResponse.json({ error: "quotation_id required" }, { status: 400 });

  const { data, error } = await supabase
    .from("print_jobs")
    .select("*")
    .eq("quotation_id", quotationId)
    .order("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const jobs = Array.isArray(body) ? body : [body];
  const { data, error } = await supabase.from("print_jobs").insert(jobs).select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { id, ...updates } = body;
  const { data, error } = await supabase.from("print_jobs").update(updates).eq("id", id).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const { id } = await request.json();
  const { error } = await supabase.from("print_jobs").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
