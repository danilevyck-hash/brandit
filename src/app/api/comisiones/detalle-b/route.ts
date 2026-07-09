// Drill-down Formato B por vendedor. Solo admin.
//   GET ?anio=&meses=1,2&vendedor=NOMBRE
//     → VENTAS (fecha, cliente, numero, tipo FA/NC/ND, subtotal firmado)
//     + COBROS (fecha, cliente, monto, por cartera, sin retenciones)
//     + CIERRE (bases × 1% por mes → total).
//   Un solo mes con snapshot generado → sirve el detalle CONGELADO desde
//   comisiones_snapshot_recibos (formato B); si no, cálculo en vivo.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { requireRoles } from "@/lib/auth-brandit";
import { loadCarteraMap } from "@/lib/switch-api/sync-clientes-cartera";
import { normalizeVendedor, round2, tipoDocCorto, FORMATO_B_TASA, type FormatoBMes } from "@/lib/comisiones";
import { fetchRecibosMes, fetchFacturasMes, subtotalFirmado, carteraDeRecibo } from "@/lib/comisiones-b";

export const dynamic = "force-dynamic";

interface VentaDoc { mes: number; fecha: string | null; cliente: string | null; numero: string | null; tipo: string; subtotal: number }
interface CobroDoc { mes: number; fecha: string | null; cliente: string | null; monto: number }

function cierreDe(ventas: VentaDoc[], cobros: CobroDoc[], meses: number[]) {
  const porMes: FormatoBMes[] = meses.map((mes) => {
    const ventas_base = round2(ventas.filter((v) => v.mes === mes).reduce((a, v) => a + v.subtotal, 0));
    const cobros_base = round2(cobros.filter((c) => c.mes === mes).reduce((a, c) => a + c.monto, 0));
    return {
      mes, ventas_base, cobros_base,
      comision_venta: round2(ventas_base * FORMATO_B_TASA),
      comision_cobro: round2(cobros_base * FORMATO_B_TASA),
    };
  });
  const sum = (k: keyof FormatoBMes) => round2(porMes.reduce((a, m) => a + (m[k] as number), 0));
  const comision_venta = sum("comision_venta");
  const comision_cobro = sum("comision_cobro");
  return {
    porMes,
    ventas_base: sum("ventas_base"),
    cobros_base: sum("cobros_base"),
    comision_venta,
    comision_cobro,
    comision_total: round2(comision_venta + comision_cobro),
  };
}

export async function GET(req: NextRequest) {
  const auth = requireRoles(req, ["admin"]);
  if (auth instanceof NextResponse) return auth;

  const sp = req.nextUrl.searchParams;
  const anio = parseInt(sp.get("anio") ?? "", 10);
  const vendedor = normalizeVendedor(sp.get("vendedor"));
  const meses = Array.from(new Set(
    (sp.get("meses") ?? sp.get("mes") ?? "").split(",").map((s) => parseInt(s.trim(), 10)),
  )).sort((a, b) => a - b);

  if (!Number.isInteger(anio) || anio < 2024 || anio > 2100) {
    return NextResponse.json({ error: "anio inválido" }, { status: 400 });
  }
  if (meses.length === 0 || meses.some((m) => !Number.isInteger(m) || m < 1 || m > 12)) {
    return NextResponse.json({ error: "mes inválido (1..12)" }, { status: 400 });
  }
  if (!vendedor) {
    return NextResponse.json({ error: "vendedor requerido" }, { status: 400 });
  }

  try {
    const db = getSupabaseServer();

    // Un solo mes con cierre generado → detalle congelado del snapshot.
    if (meses.length === 1) {
      const mes = meses[0];
      const { data: snap, error: snapErr } = await db
        .from("comisiones_snapshot")
        .select("id")
        .eq("anio", anio)
        .eq("mes", mes)
        .maybeSingle();
      if (snapErr) throw new Error(snapErr.message);

      if (snap) {
        const { data: det, error } = await db
          .from("comisiones_snapshot_recibos")
          .select("fecha,cliente_nombre,vendedor_nombre,total,seccion,tipo_doc,numero_doc,formato")
          .eq("snapshot_id", snap.id)
          .eq("formato", "B")
          .order("fecha", { ascending: true })
          .range(0, 99999);
        if (error) throw new Error(error.message);

        const mias = (det ?? []).filter((r) => normalizeVendedor(r.vendedor_nombre as string) === vendedor);
        const ventas: VentaDoc[] = mias
          .filter((r) => r.seccion === "venta")
          .map((r) => ({
            mes, fecha: r.fecha as string | null, cliente: r.cliente_nombre as string | null,
            numero: (r.numero_doc as string | null) ?? null, tipo: (r.tipo_doc as string | null) ?? "FA",
            subtotal: Number(r.total ?? 0),
          }));
        const cobros: CobroDoc[] = mias
          .filter((r) => r.seccion === "cobro")
          .map((r) => ({
            mes, fecha: r.fecha as string | null, cliente: r.cliente_nombre as string | null,
            monto: Number(r.total ?? 0),
          }));
        return NextResponse.json({
          anio, meses, vendedor, frozen: true, ventas, cobros,
          cierre: cierreDe(ventas, cobros, meses),
        });
      }
    }

    // Cálculo en vivo (uno o varios meses).
    const [facturasPorMes, recibosPorMes, carteraMap] = await Promise.all([
      Promise.all(meses.map((m) => fetchFacturasMes(anio, m))),
      Promise.all(meses.map((m) => fetchRecibosMes(anio, m))),
      loadCarteraMap(),
    ]);

    const ventas: VentaDoc[] = facturasPorMes.flat()
      .filter((f) => normalizeVendedor(f.vendedor_nombre) === vendedor)
      .map((f) => ({
        mes: f.mes, fecha: f.fecha, cliente: f.cliente_nombre, numero: f.numero,
        tipo: tipoDocCorto(f.tipo_comprobante), subtotal: round2(subtotalFirmado(f)),
      }));
    const cobros: CobroDoc[] = recibosPorMes.flat()
      .filter((r) => !r.es_retencion && normalizeVendedor(carteraDeRecibo(r, carteraMap)) === vendedor)
      .map((r) => ({ mes: r.mes, fecha: r.fecha, cliente: r.cliente_nombre, monto: round2(r.total) }));

    return NextResponse.json({
      anio, meses, vendedor, frozen: false, ventas, cobros,
      cierre: cierreDe(ventas, cobros, meses),
    });
  } catch (e) {
    console.error("[comisiones detalle-b GET]", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
