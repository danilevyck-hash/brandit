// GET /api/cron/sync-recibos
//
// SYNC-2: cron dedicado de RECIBOS (cobros) → switch_recibos. Vive aparte de
// switch-sync para no competir por el maxDuration (300s) con el estado de cuenta.
// Horario propio en vercel.json (07:00 UTC), separado de switch-sync (05:00).
//
// Auth: Bearer ${CRON_SECRET} o ?secret=... (paridad con switch-sync).
// Params (opcionales): year=YYYY · mes=1..12 · backfill=1
//   sin params → mes en curso; días 1-5 del mes también el mes anterior.

import { NextRequest, NextResponse } from "next/server";
import {
  syncRecibos,
  mesActual,
  mesesCronDiario,
  mesesDeAnio,
  type Mes,
} from "@/lib/switch-api/sync-recibos";
import { syncClientesCartera } from "@/lib/switch-api/sync-clientes-cartera";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

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

  const sp = req.nextUrl.searchParams;

  // Validación de params manuales.
  const mesParam = sp.get("mes");
  if (mesParam !== null) {
    const m = parseInt(mesParam, 10);
    if (!Number.isInteger(m) || m < 1 || m > 12) {
      return NextResponse.json({ error: "mes inválido (1..12)" }, { status: 400 });
    }
  }
  const yearParam = sp.get("year");
  if (yearParam !== null) {
    const y = parseInt(yearParam, 10);
    if (!Number.isInteger(y) || y < 2024 || y > mesActual().year + 1) {
      return NextResponse.json({ error: "year inválido" }, { status: 400 });
    }
  }

  // Cartera PRIMERO: los recibos del mismo run se atribuyen con la lista fresca.
  // Si la cartera falla, recibos corre igual (fallback al vendedor del recibo).
  const cartera = await syncClientesCartera();
  const recibos = await syncRecibos(recibosMeses(sp));
  const anyError = recibos.status === "error" || cartera.status === "error";

  return NextResponse.json({ ok: !anyError, cartera, recibos }, { status: anyError ? 207 : 200 });
}
