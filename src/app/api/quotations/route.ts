import { getSupabaseServer } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { requireRoles } from "@/lib/auth-brandit";

export const dynamic = "force-dynamic";

// SEC-4: columnas permitidas en el update (anti mass-assignment).
const QUOTATION_FIELDS = ["client_id", "date", "status", "notes"] as const;
function pickQuotationFields(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of QUOTATION_FIELDS) if (k in body) out[k] = body[k];
  return out;
}

export async function GET(request: NextRequest) {
  const auth = requireRoles(request, ["admin", "secretaria", "vendedora"]);
  if (auth instanceof NextResponse) return auth;

  const supabase = getSupabaseServer();
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
  const auth = requireRoles(request, ["admin", "secretaria", "vendedora"]);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const { data, error } = await getSupabaseServer()
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
  const auth = requireRoles(request, ["admin", "secretaria", "vendedora"]);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const { id } = body;
  const updates = pickQuotationFields(body);
  const { data, error } = await getSupabaseServer().from("quotations").update(updates).eq("id", id).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  // SEC-5: borrado destructivo solo admin/secretaria.
  const auth = requireRoles(request, ["admin", "secretaria"]);
  if (auth instanceof NextResponse) return auth;

  const { id } = await request.json();
  const { error } = await getSupabaseServer().from("quotations").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
