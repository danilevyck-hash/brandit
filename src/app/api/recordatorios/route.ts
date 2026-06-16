import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { logActivity } from "@/lib/activity-log";
import { requireRoles, getSessionPayload, type Role } from "@/lib/auth-brandit";

const RECORD_ROLES: readonly Role[] = ["admin", "secretaria"];

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = requireRoles(req, RECORD_ROLES);
  if (auth instanceof NextResponse) return auth;

  const cumplidos = req.nextUrl.searchParams.get("cumplidos") === "1";

  const query = getSupabaseServer().from("recordatorios_pago").select("*");

  const { data, error } = cumplidos
    ? await query.eq("cumplido", true).order("cumplido_at", { ascending: false })
    : await query.eq("cumplido", false).order("fecha_prometida", { ascending: true });

  if (error) { console.error(error); return NextResponse.json({ error: "Error interno" }, { status: 500 }); }
  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  const auth = requireRoles(req, RECORD_ROLES);
  if (auth instanceof NextResponse) return auth;
  const session = getSessionPayload(req);
  if (!session?.userId) return NextResponse.json({ error: "Sesión inválida" }, { status: 401 });

  const body = await req.json();

  const cliente = typeof body.cliente === "string" ? body.cliente.trim() : "";
  if (!cliente) return NextResponse.json({ error: "El cliente es obligatorio." }, { status: 400 });

  const fecha = body.fecha_prometida;
  if (!fecha || typeof fecha !== "string") return NextResponse.json({ error: "La fecha prometida es obligatoria." }, { status: 400 });

  let monto: number | null = null;
  if (body.monto !== undefined && body.monto !== null && String(body.monto).trim() !== "") {
    const n = Number(body.monto);
    if (isNaN(n) || n < 0) return NextResponse.json({ error: "El monto no es válido." }, { status: 400 });
    monto = Math.round(n * 100) / 100;
  }

  const nota = typeof body.nota === "string" ? body.nota.trim() : "";

  const { data, error } = await getSupabaseServer()
    .from("recordatorios_pago")
    .insert({
      cliente,
      monto,
      fecha_prometida: fecha,
      nota: nota || null,
      created_by: session?.nombre ?? session?.userId ?? null,
    })
    .select()
    .single();

  if (error) { console.error(error); return NextResponse.json({ error: "Error interno" }, { status: 500 }); }

  await logActivity(session?.nombre || "sistema", "recordatorio_create", cliente);

  return NextResponse.json(data);
}
