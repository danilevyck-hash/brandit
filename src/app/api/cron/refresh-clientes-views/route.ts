// GET /api/cron/refresh-clientes-views
//
// Disparado por Vercel cron a las 5 UTC daily (configurado en vercel.json).
// Refresca la matview clientes_empresa_12m_vw para que los KPIs del Tab
// Clientes reflejen el último día (12m rolling absoluto desde NOW).
//
// Auth: Bearer ${CRON_SECRET} o ?secret=... query param (paridad con
// /api/cron/backup). El secret ya existe como env var en Vercel.
//
// Refresh ejecutado vía RPC refresh_clientes_empresa_12m_vw() — una función
// SECURITY DEFINER que hace REFRESH MATERIALIZED VIEW CONCURRENTLY (requiere
// unique index, ya garantizado por idx_clientes_empresa_12m_vw_unq).

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret =
    req.headers.get("authorization")?.replace("Bearer ", "") ||
    req.nextUrl.searchParams.get("secret");

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getSupabaseServer();
  try {
    const { error } = await db.rpc("refresh_clientes_empresa_12m_vw");
    if (error) throw new Error(error.message);
    const refreshed_at = new Date().toISOString();
    console.log("[cron/refresh-clientes-views] OK at", refreshed_at);
    return NextResponse.json({ ok: true, refreshed_at });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    console.error("[cron/refresh-clientes-views] error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
