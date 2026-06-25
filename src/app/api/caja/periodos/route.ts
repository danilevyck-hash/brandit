import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { requireRoles, getSessionPayload, type Role } from "@/lib/auth-brandit";

const CAJA_ROLES: readonly Role[] = ["admin", "secretaria"];

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = requireRoles(req, CAJA_ROLES);
  if (auth instanceof NextResponse) return auth;
  const tipoParam = new URL(req.url).searchParams.get("tipo");
  const tipo = tipoParam === "yappy" ? "yappy" : "efectivo";
  const { data, error } = await getSupabaseServer()
    .from("caja_periodos")
    .select("*, caja_gastos(total, deleted)")
    .eq("deleted", false)
    .eq("tipo", tipo)
    .order("numero", { ascending: false });

  if (error) { console.error(error); return NextResponse.json({ error: "Error interno" }, { status: 500 }); }

  const result = (data || []).map((p) => ({
    ...p,
    total_gastado: (p.caja_gastos || [])
      .filter((g: { deleted?: boolean }) => !g.deleted)
      .reduce((s: number, g: { total: number }) => s + (g.total || 0), 0),
  }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const auth = requireRoles(req, CAJA_ROLES);
  if (auth instanceof NextResponse) return auth;
  const session = getSessionPayload(req);
  if (!session?.userId) return NextResponse.json({ error: "Sesión inválida" }, { status: 401 });

  let fondo = 200;
  let tipo: "efectivo" | "yappy" = "efectivo";
  try {
    const body = await req.json();
    if (body.fondo_inicial && !isNaN(Number(body.fondo_inicial))) {
      fondo = Number(body.fondo_inicial);
    }
    if (body.tipo === "yappy" || body.tipo === "efectivo") {
      tipo = body.tipo;
    }
  } catch { /* empty body = default fondo */ }

  // Numeración independiente por tipo: cada caja (efectivo/yappy) lleva su propia
  // secuencia 1, 2, 3...
  const { data: last } = await getSupabaseServer()
    .from("caja_periodos")
    .select("numero")
    .eq("tipo", tipo)
    .order("numero", { ascending: false })
    .limit(1)
    .single();

  const numero = (last?.numero || 0) + 1;
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await getSupabaseServer()
    .from("caja_periodos")
    .insert({ numero, fecha_apertura: today, fondo_inicial: fondo, estado: "abierto", tipo, created_by: session?.nombre ?? session?.userId ?? null })
    .select()
    .single();

  if (error) { console.error(error); return NextResponse.json({ error: "Error interno" }, { status: 500 }); }
  return NextResponse.json(data);
}
