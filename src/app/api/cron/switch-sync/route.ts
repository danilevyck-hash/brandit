// GET /api/cron/switch-sync
//
// Disparado por Vercel cron a las 5 UTC daily (configurado en vercel.json).
// Corre los 3 syncs de Switch en serie para Boston: facturas → estado de cuenta
// → costo diario. Para facturas usa una ventana de los últimos 7 días (catch-up
// por si alguna corrida previa falló).
//
// Auth: Bearer ${CRON_SECRET} o ?secret=... (paridad con los otros crons).
//
// NOTA: sin las env vars SWITCH_BOSTON_API_* configuradas, createSwitchClient()
// tira y cada sync devuelve status 'error' (registrado en switch_sync_log).
// Eso es ESPERADO hasta que se configure el usuario API dedicado.

import { NextRequest, NextResponse } from "next/server";
import { syncFacturas, syncEstadocuenta, syncCostoDiario } from "@/lib/switch-api/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function fmtDate(d: Date): string {
  return d.toISOString().split("T")[0]; // YYYY-MM-DD
}

export async function GET(req: NextRequest) {
  const secret =
    req.headers.get("authorization")?.replace("Bearer ", "") ||
    req.nextUrl.searchParams.get("secret");

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hoy = new Date();
  const hasta = fmtDate(hoy);
  const desdeDate = new Date(hoy);
  desdeDate.setDate(desdeDate.getDate() - 7); // catch-up últimos 7 días
  const desde = fmtDate(desdeDate);
  const mes = hasta.slice(0, 7); // YYYY-MM

  // En serie — Switch puede rate-limitar y el costo es chico (single-empresa).
  const facturas = await syncFacturas({ desde, hasta });
  const estadocuenta = await syncEstadocuenta();
  const costo = await syncCostoDiario(mes);

  const anyError = [facturas, estadocuenta, costo].some((r) => r.status === "error");

  return NextResponse.json(
    {
      ok: !anyError,
      ventana: { desde, hasta },
      mes,
      facturas,
      estadocuenta,
      costo,
    },
    { status: anyError ? 207 : 200 }
  );
}
