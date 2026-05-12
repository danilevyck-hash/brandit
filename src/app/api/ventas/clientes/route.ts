// GET /api/ventas/clientes
//
// Combina fetchClientes (KPIs por cliente desde matview) + fetchClientesMonthly
// (sparkline 12m vía RPC) en paralelo. Lazy-cargado desde el Tab Clientes en el
// browser (no se invoca en el Server Component de /ventas para no penalizar
// el Tab Resumen, que carga primero el 99% del tiempo).
//
// Response shape:
//   {
//     rows: Cliente[],                            // ordenado por última_compra desc
//     monthly: Record<cliente_codigo, number[]>,  // array de 12 numbers por cliente
//   }
//
// Frontend joinéa por `cliente_codigo`. Clientes sin entry en `monthly`
// (huérfanos sin codigo) usan array de 12 ceros como fallback.

import { NextRequest, NextResponse } from "next/server";
import { fetchClientes, fetchClientesMonthly } from "@/lib/ventas/queries";
import { requireRoles } from "@/lib/auth-brandit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const auth = requireRoles(req, ["admin"]);
  if (auth instanceof NextResponse) return auth;

  try {
    // El `year` se ignora en fetchClientes (matview es 12m rolling absoluto),
    // pero la firma lo exige por compat con otros tabs.
    const year = new Date().getFullYear();
    const [clientes, monthly] = await Promise.all([
      fetchClientes({ year }),
      fetchClientesMonthly(),
    ]);

    return NextResponse.json({
      rows: clientes.rows,
      monthly,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    console.error("[api/ventas/clientes] error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
