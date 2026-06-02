import { getSupabaseServer } from "@/lib/supabase-server";
import { NextResponse, NextRequest } from "next/server";
import { requireRoles, getSessionPayload } from "@/lib/auth-brandit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = requireRoles(req, ["admin", "secretaria", "vendedora"]);
  if (auth instanceof NextResponse) return auth;

  // Nombre real desde la sesión verificada (httpOnly) — fuente de verdad para
  // el saludo de la home, en lugar de depender solo de localStorage.
  const nombre = getSessionPayload(req)?.nombre ?? null;

  const db = getSupabaseServer();
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  // 6 months ago for chart data
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const sixMonthsAgoStr = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, "0")}-01`;

  const [
    leadsRes,
    prospectosRes,
    convertidosRes,
    seguimientosRes,
    cxcUploadRes,
    cxcRowsLatestUpload,
    guiasRes,
    cajaRes,
    leadsForCharts,
  ] = await Promise.all([
    // Total leads
    db.from("leads").select("id", { count: "exact", head: true }),
    // Prospectos activos
    db.from("leads").select("id", { count: "exact", head: true })
      .eq("estado", "prospecto").eq("estado_venta", "activo"),
    // Convertidos este mes
    db.from("leads").select("id", { count: "exact", head: true })
      .eq("estado_venta", "convertido").gte("created_at", monthStart),
    // Seguimientos vencidos
    db.from("leads").select("id", { count: "exact", head: true })
      .lte("fecha_seguimiento", today).eq("estado_venta", "activo"),
    // Latest CxC upload
    db.from("cxc_uploads").select("id, uploaded_at, filename")
      .eq("company_key", "confecciones_boston")
      .order("uploaded_at", { ascending: false }).limit(1),
    // We'll get rows after we know the upload id — use a placeholder
    Promise.resolve(null),
    // Guías este mes
    db.from("guia_transporte").select("id", { count: "exact", head: true })
      .gte("created_at", monthStart),
    // Caja: período abierto con sus gastos
    db.from("caja_periodos").select("*, gastos:caja_gastos(total)")
      .eq("estado", "abierto").limit(1),
    // Leads for charts (last 6 months, with vendedora and estado_venta)
    db.from("leads").select("created_at, vendedora, estado_venta")
      .gte("created_at", sixMonthsAgoStr),
  ]);

  // CxC desde switch_estadocuenta (data validada del sync Switch), igual que
  // /api/cxc. "Deuda 90+" = buckets > 90 días (91-120, 121-180, 181-270,
  // 271-365, +365) — misma definición que la suma vieja de d_91_120..d_mas_365
  // sobre cxc_rows. Net-zero y bucket ya resueltos por syncEstadocuenta.
  const latestUpload = cxcUploadRes.data?.[0] || null; // solo para ultimo_upload
  let cxcTotalClientes = 0;
  let cxcDeuda90Plus = 0;
  let cxcDeuda0_30 = 0;

  const NOVENTA_PLUS = new Set(["91-120", "121-180", "181-270", "271-365", "+365"]);
  const { data: cxcDocs } = await db
    .from("switch_estadocuenta")
    .select("cliente_codigo, bucket, saldo")
    .limit(20000);

  if (cxcDocs) {
    const clientes = new Set<string>();
    for (const r of cxcDocs as { cliente_codigo: string; bucket: string | null; saldo: number | string }[]) {
      clientes.add(r.cliente_codigo);
      const s = typeof r.saldo === "number" ? r.saldo : Number(r.saldo) || 0;
      if (r.bucket && NOVENTA_PLUS.has(r.bucket)) cxcDeuda90Plus += s;
      else if (r.bucket === "0-30") cxcDeuda0_30 += s;
    }
    cxcTotalClientes = clientes.size;
  }

  // Caja gastos del período activo
  const periodoAbierto = cajaRes.data?.[0];
  let cajaGastosMes = 0;
  if (periodoAbierto) {
    cajaGastosMes = (periodoAbierto.gastos || []).reduce(
      (sum: number, g: { total: number }) => sum + Number(g.total), 0
    );
  }

  // Build leadsPorMes — last 6 months
  const mesesAbrev = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const leadsPorMesMap: Record<string, number> = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    leadsPorMesMap[key] = 0;
  }
  for (const l of leadsForCharts.data || []) {
    const key = (l.created_at as string).slice(0, 7); // "YYYY-MM"
    if (key in leadsPorMesMap) leadsPorMesMap[key]++;
  }
  const leadsPorMes = Object.entries(leadsPorMesMap).map(([key, count]) => {
    const [y, m] = key.split("-");
    return { mes: `${mesesAbrev[Number(m) - 1]} ${y.slice(2)}`, count };
  });

  // Build conversionPorVendedora
  const vendedoraMap: Record<string, { total: number; convertidos: number }> = {};
  for (const l of leadsForCharts.data || []) {
    const v = (l.vendedora as string) || "Sin asignar";
    if (!vendedoraMap[v]) vendedoraMap[v] = { total: 0, convertidos: 0 };
    vendedoraMap[v].total++;
    const ev = l.estado_venta === "perdido" ? "no_convertido" : (l.estado_venta as string);
    if (ev === "convertido") vendedoraMap[v].convertidos++;
  }
  const conversionPorVendedora = Object.entries(vendedoraMap)
    .filter(([, v]) => v.total >= 1)
    .map(([vendedora, v]) => ({
      vendedora,
      porcentaje: Math.round((v.convertidos / v.total) * 100),
      total: v.total,
    }))
    .sort((a, b) => b.porcentaje - a.porcentaje);

  return NextResponse.json({
    nombre,
    leads: {
      total: leadsRes.count || 0,
      prospectos_activos: prospectosRes.count || 0,
      convertidos_mes: convertidosRes.count || 0,
      seguimientos_vencidos: seguimientosRes.count || 0,
    },
    cxc: {
      total_clientes: cxcTotalClientes,
      deuda_90_plus: cxcDeuda90Plus,
      deuda_0_30: cxcDeuda0_30,
      ultimo_upload: latestUpload?.uploaded_at || null,
    },
    operaciones: {
      guias_mes: guiasRes.count || 0,
      gastos_caja_mes: cajaGastosMes,
    },
    leadsPorMes,
    conversionPorVendedora,
  });
}
