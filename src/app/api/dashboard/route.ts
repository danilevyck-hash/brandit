import { getSupabaseAF } from "@/lib/supabase-af";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getSupabaseAF();
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const [
    leadsRes,
    prospectosRes,
    convertidosRes,
    seguimientosRes,
    cxcUploadRes,
    cxcRowsLatestUpload,
    guiasRes,
    cajaRes,
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
  ]);

  // CxC rows from latest upload
  const latestUpload = cxcUploadRes.data?.[0] || null;
  let cxcTotalClientes = 0;
  let cxcDeuda90Plus = 0;
  let cxcDeuda0_30 = 0;

  if (latestUpload) {
    const { data: cxcRows } = await db
      .from("cxc_rows")
      .select("d_0_30, d_91_120, d_121_180, d_181_270, d_271_365, d_mas_365")
      .eq("upload_id", latestUpload.id);

    if (cxcRows) {
      cxcTotalClientes = cxcRows.length;
      for (const r of cxcRows) {
        cxcDeuda90Plus += Number(r.d_91_120) + Number(r.d_121_180) + Number(r.d_181_270) + Number(r.d_271_365) + Number(r.d_mas_365);
        cxcDeuda0_30 += Number(r.d_0_30);
      }
    }
  }

  // Caja gastos del período activo
  const periodoAbierto = cajaRes.data?.[0];
  let cajaGastosMes = 0;
  if (periodoAbierto) {
    cajaGastosMes = (periodoAbierto.gastos || []).reduce(
      (sum: number, g: { total: number }) => sum + Number(g.total), 0
    );
  }

  return NextResponse.json({
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
  });
}
