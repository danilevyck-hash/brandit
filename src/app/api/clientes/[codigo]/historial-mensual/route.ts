// ─────────────────────────────────────────────────────────────────────────────
// GET /api/clientes/[codigo]/historial-mensual
//
// Devuelve agregado mensual de ventas de los últimos 12 meses cerrados +
// el mes actual, para el cliente Boston indicado. Pensado para alimentar
// la mini gráfica (sparkline) que aparece al hover sobre el nombre del
// cliente en la tab Clientes del módulo Ventas.
//
// [codigo] = código Switch Soft del cliente (ej. "D-04"), igual que Cliente.id
// del bundle del frontend de Ventas. Empresa hardcoded a Boston.
//
// Stats accionables (mismo shape que fashiongr):
//   - total_12m
//   - promedio_mensual:        SUM(total) / COUNT(DISTINCT meses con compra)
//   - meses_activos:           0-12
//   - dias_desde_ultima_compra: int o null
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { requireRoles } from "@/lib/auth-brandit";

export const dynamic = "force-dynamic";

const COMPANY_KEY = "confecciones_boston";

interface MesAgg {
  anio: number;
  mes: number;
  total: number;
  facturas: number;
}

interface VentaRow {
  anio: number | null;
  mes: number | null;
  fecha: string | null;
  total: number | null;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ codigo: string }> }) {
  const auth = requireRoles(req, ["admin"]);
  if (auth instanceof NextResponse) return auth;

  const { codigo } = await ctx.params;
  if (!codigo) {
    return NextResponse.json({ error: "codigo requerido" }, { status: 400 });
  }

  const db = getSupabaseServer();

  // 1. Resolver cliente_id por código (Switch Soft)
  const { data: cliente, error: cErr } = await db
    .from("clientes_master")
    .select("id, codigo, nombre")
    .eq("codigo", codigo)
    .eq("deleted", false)
    .maybeSingle();

  if (cErr) {
    console.error("[historial-mensual] cliente lookup error:", cErr.message);
    return NextResponse.json({ error: cErr.message }, { status: 500 });
  }
  if (!cliente) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  // 2. Ventana de 13 meses (mes actual + 12 atrás)
  const now = new Date();
  const fromDate = new Date(now.getFullYear(), now.getMonth() - 12, 1);
  const fromIso = fromDate.toISOString().slice(0, 10);

  const { data: rows, error: vErr } = await db
    .from("ventas_raw")
    .select("anio, mes, fecha, total")
    .eq("cliente_id", cliente.id)
    .eq("empresa", COMPANY_KEY)
    .gte("fecha", fromIso);

  if (vErr) {
    console.error("[historial-mensual] ventas query error:", vErr.message);
    return NextResponse.json({ error: vErr.message }, { status: 500 });
  }

  // 3. Agregar por (anio, mes) + trackear fecha máxima
  const bucket = new Map<string, MesAgg>();
  let maxFechaIso: string | null = null;
  for (const r of (rows ?? []) as VentaRow[]) {
    let anio = r.anio ?? 0;
    let mes = r.mes ?? 0;
    if ((!anio || !mes) && r.fecha) {
      const d = new Date(r.fecha);
      anio = d.getUTCFullYear();
      mes = d.getUTCMonth() + 1;
    }
    if (!anio || !mes) continue;

    if (r.fecha && (!maxFechaIso || r.fecha > maxFechaIso)) {
      maxFechaIso = r.fecha;
    }

    const key = `${anio}-${mes}`;
    const prev = bucket.get(key);
    const total = Number(r.total ?? 0);
    if (prev) {
      prev.total += total;
      prev.facturas += 1;
    } else {
      bucket.set(key, { anio, mes, total, facturas: 1 });
    }
  }

  // 4. Generar serie completa de 13 meses, rellenando huecos con 0
  const meses: MesAgg[] = [];
  for (let i = 12; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const anio = d.getFullYear();
    const mes = d.getMonth() + 1;
    const found = bucket.get(`${anio}-${mes}`);
    meses.push({
      anio,
      mes,
      total: Math.round((found?.total ?? 0) * 100) / 100,
      facturas: found?.facturas ?? 0,
    });
  }

  // 5. Stats accionables
  const total12m = meses.reduce((s, m) => s + m.total, 0);
  const mesesActivos = meses.filter(m => m.total > 0).length;
  const promedioMensual = mesesActivos > 0 ? total12m / mesesActivos : 0;
  let diasDesdeUltimaCompra: number | null = null;
  if (maxFechaIso) {
    const ms = Date.parse(maxFechaIso);
    if (!Number.isNaN(ms)) {
      diasDesdeUltimaCompra = Math.max(0, Math.floor((Date.now() - ms) / 86_400_000));
    }
  }

  return NextResponse.json({
    cliente_nombre: cliente.nombre as string,
    meses,
    total_12m: Math.round(total12m * 100) / 100,
    promedio_mensual: Math.round(promedioMensual * 100) / 100,
    meses_activos: mesesActivos,
    dias_desde_ultima_compra: diasDesdeUltimaCompra,
  });
}
