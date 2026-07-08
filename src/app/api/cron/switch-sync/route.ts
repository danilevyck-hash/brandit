// GET /api/cron/switch-sync
//
// Disparado por Vercel cron a las 5 UTC daily (configurado en vercel.json).
// Corre los 3 syncs de Switch en serie para Boston: facturas → estado de cuenta
// → costo diario. Para facturas usa una ventana de los últimos 7 días (catch-up
// por si alguna corrida previa falló).
//
// Auth: Bearer ${CRON_SECRET} o ?secret=... (paridad con los otros crons).
//
// RED DE SEGURIDAD del estado de cuenta: el sync usa un cursor reanudable
// (switch_sync_cursor). Si una vuelta quedó a medias (timeout, o auto-encadenado
// que no disparó), ESTE mismo cron diario la RETOMA desde donde quedó en su
// próxima corrida — la lógica vive en syncEstadocuenta (carga el cursor primero y
// solo arranca vuelta nueva si está limpio). No depende del self-fetch ni de Pro.
//
// NOTA: sin las env vars SWITCH_BOSTON_API_* configuradas, createSwitchClient()
// tira y cada sync devuelve status 'error' (registrado en switch_sync_log).
// Eso es ESPERADO hasta que se configure el usuario API dedicado.

import { NextRequest, NextResponse } from "next/server";
import { syncFacturas, syncEstadocuenta, syncCostoDiario } from "@/lib/switch-api/sync";
import {
  syncRecibos,
  mesActual,
  mesesCronDiario,
  mesesDeAnio,
  type Mes,
} from "@/lib/switch-api/sync-recibos";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // Pro — el sync de estado de cuenta itera ~361 clientes

function fmtDate(d: Date): string {
  return d.toISOString().split("T")[0]; // YYYY-MM-DD
}

/**
 * Meses de recibos a sincronizar según params (paridad con backfill/mes de los
 * otros syncs):
 *   backfill=1[&year=YYYY] → todos los meses del año hasta el mes en curso.
 *   year=YYYY&mes=M        → ese único mes.
 *   (sin params)           → mes en curso; días 1-5 también el mes anterior.
 */
function recibosMeses(sp: URLSearchParams): Mes[] {
  const cur = mesActual();
  const year = sp.get("year") ? parseInt(sp.get("year")!, 10) : cur.year;
  if (sp.get("backfill") === "1") {
    return mesesDeAnio(year, year === cur.year ? cur.month : 12);
  }
  const mesParam = sp.get("mes");
  if (mesParam) {
    const mes = parseInt(mesParam, 10);
    return [{ year, month: mes }];
  }
  return mesesCronDiario();
}

export async function GET(req: NextRequest) {
  const secret =
    req.headers.get("authorization")?.replace("Bearer ", "") ||
    req.nextUrl.searchParams.get("secret");

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Continuación del cursor de estado de cuenta: corre SOLO estadocuenta (no
  // re-ejecuta facturas/costo en cada eslabón del encadenado).
  const onlyEstado = req.nextUrl.searchParams.get("only") === "estadocuenta";

  const hoy = new Date();
  const hasta = fmtDate(hoy);
  const desdeDate = new Date(hoy);
  desdeDate.setDate(desdeDate.getDate() - 7); // catch-up últimos 7 días
  const desde = fmtDate(desdeDate);
  const mes = hasta.slice(0, 7); // YYYY-MM

  // Validación de params manuales de recibos (mes 1..12).
  const mesParam = req.nextUrl.searchParams.get("mes");
  if (mesParam !== null) {
    const m = parseInt(mesParam, 10);
    if (!Number.isInteger(m) || m < 1 || m > 12) {
      return NextResponse.json({ error: "mes inválido (1..12)" }, { status: 400 });
    }
  }
  const yearParam = req.nextUrl.searchParams.get("year");
  if (yearParam !== null) {
    const y = parseInt(yearParam, 10);
    if (!Number.isInteger(y) || y < 2024 || y > mesActual().year + 1) {
      return NextResponse.json({ error: "year inválido" }, { status: 400 });
    }
  }

  // En serie — Switch tiene SESIÓN ÚNICA; nada en paralelo (evita colisión de token).
  const facturas = onlyEstado ? null : await syncFacturas({ desde, hasta });
  const estadocuenta = await syncEstadocuenta();
  const costo = onlyEstado ? null : await syncCostoDiario(mes);
  // Recibos (cobros) tras costo. Salta en el encadenado de solo-estadocuenta.
  const recibos = onlyEstado ? null : await syncRecibos(recibosMeses(req.nextUrl.searchParams));

  // Auto-encadenado: si la vuelta de estado de cuenta quedó a medias, disparar la
  // siguiente corrida (solo estadocuenta) en otra instancia serverless. Fire-and-
  // forget con un flush corto para asegurar que el request SALGA antes de devolver
  // (en serverless la función se congela tras el response).
  let chained = false;
  if (estadocuenta.status === "partial-cursor") {
    chained = true;
    const url = `${req.nextUrl.origin}/api/cron/switch-sync?only=estadocuenta`;
    const headers: Record<string, string> = {};
    if (process.env.CRON_SECRET) headers.authorization = `Bearer ${process.env.CRON_SECRET}`;
    try {
      const p = fetch(url, { headers, cache: "no-store" }).catch(() => {});
      await Promise.race([p, new Promise((r) => setTimeout(r, 800))]);
    } catch { /* fire-and-forget */ }
  }

  const anyError = [facturas, estadocuenta, costo, recibos].some((r) => r != null && r.status === "error");

  return NextResponse.json(
    {
      ok: !anyError,
      ventana: { desde, hasta },
      mes,
      onlyEstado,
      chained,
      resumed: estadocuenta.resumed ?? false,
      remaining: estadocuenta.remaining ?? 0,
      facturas,
      estadocuenta,
      costo,
      recibos,
    },
    { status: anyError ? 207 : 200 }
  );
}
