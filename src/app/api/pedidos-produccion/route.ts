import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { logActivity } from "@/lib/activity-log";
import { requireRoles, getSessionPayload, type Role } from "@/lib/auth-brandit";

const PEDIDOS_ROLES: readonly Role[] = ["admin", "secretaria", "vendedora"];

const TIPOS_VALIDOS = ["DTF", "UV DTF", "Sublimación", "Bordado", "Grabado láser", "Gran formato", "Confección"];
const ESTADOS_VALIDOS = ["Pendiente", "En proceso", "Listo"];

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = requireRoles(req, PEDIDOS_ROLES);
  if (auth instanceof NextResponse) return auth;

  const { data, error } = await getSupabaseServer()
    .from("pedidos_produccion")
    .select("*")
    .order("orden", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) { console.error(error); return NextResponse.json({ error: "Error interno" }, { status: 500 }); }
  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  const auth = requireRoles(req, PEDIDOS_ROLES);
  if (auth instanceof NextResponse) return auth;
  const session = getSessionPayload(req);
  if (!session?.userId) return NextResponse.json({ error: "Sesión inválida" }, { status: 401 });

  const body = await req.json();

  const cliente = typeof body.cliente === "string" ? body.cliente.trim() : "";
  if (!cliente) return NextResponse.json({ error: "El cliente es obligatorio." }, { status: 400 });

  const tipo = typeof body.tipo === "string" ? body.tipo.trim() : "";
  if (!TIPOS_VALIDOS.includes(tipo)) return NextResponse.json({ error: "El tipo de personalización no es válido." }, { status: 400 });

  const estado = typeof body.estado === "string" && body.estado.trim() !== "" ? body.estado.trim() : "Pendiente";
  if (!ESTADOS_VALIDOS.includes(estado)) return NextResponse.json({ error: "El estado no es válido." }, { status: 400 });

  const trabajador = typeof body.trabajador === "string" ? body.trabajador.trim() : "";
  const notas = typeof body.notas === "string" ? body.notas.trim() : "";

  let fecha: string | null = null;
  if (body.fecha_entrega !== undefined && body.fecha_entrega !== null && String(body.fecha_entrega).trim() !== "") {
    if (typeof body.fecha_entrega !== "string") return NextResponse.json({ error: "La fecha de entrega no es válida." }, { status: 400 });
    fecha = body.fecha_entrega;
  }

  const supabase = getSupabaseServer();

  // Calcula el siguiente orden: al final de la cola.
  const { data: last } = await supabase
    .from("pedidos_produccion")
    .select("orden")
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle();
  const orden = (last?.orden ?? 0) + 1;

  const { data, error } = await supabase
    .from("pedidos_produccion")
    .insert({
      cliente,
      tipo,
      trabajador: trabajador || null,
      estado,
      fecha_entrega: fecha,
      notas: notas || null,
      orden,
      created_by: session?.nombre ?? session?.userId ?? null,
    })
    .select()
    .single();

  if (error) { console.error(error); return NextResponse.json({ error: "Error interno" }, { status: 500 }); }

  await logActivity(session?.nombre || "sistema", "pedido_produccion_create", cliente);

  return NextResponse.json(data);
}
