"use client";

import type { VentasResumen } from "./types";
import { fmtMoney, fmtPct } from "@/lib/ventas/format";
import { formatDelta, type DeltaFormat } from "@/lib/ventas/formatDelta";

type Props = { data: VentasResumen };

const TONE_CLASS: Record<DeltaFormat["tone"], string> = {
  emerald: "text-emerald-600",
  orange:  "text-orange-600",
  stone:   "text-gray-400",
};

export default function ResumenView({ data }: Props) {
  const { kpis } = data;
  const ventasDelta   = formatDelta(kpis.ventasYTD,   kpis.ventasPrevYTD);
  const utilidadDelta = formatDelta(kpis.utilidadYTD, kpis.utilidadPrevYTD);
  const margenDelta   = formatDelta(kpis.margenYTD,   kpis.margenPrevYTD);

  const metaConfigured = kpis.metaAnual > 0;
  const avancePctRaw   = metaConfigured ? (kpis.ventasYTD / kpis.metaAnual) * 100 : 0;
  const avanceDisplay  = metaConfigured ? `${Math.round(avancePctRaw)}%` : "—";
  const avanceSubtitle = metaConfigured
    ? `Meta: ${fmtMoney(kpis.metaAnual)}`
    : "Meta no configurada";

  const { funnel } = data;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Ventas YTD"
          value={fmtMoney(kpis.ventasYTD)}
          delta={ventasDelta}
          subtitle="vs mismo periodo año anterior"
        />
        <KpiCard
          title="Utilidad YTD"
          value={fmtMoney(kpis.utilidadYTD)}
          delta={utilidadDelta}
          subtitle="vs mismo periodo año anterior"
        />
        <KpiCard
          title="Margen %"
          value={fmtPct(kpis.margenYTD)}
          delta={margenDelta}
          subtitle="promedio YTD"
        />
        <KpiCard
          title="Avance vs Meta"
          value={avanceDisplay}
          subtitle={avanceSubtitle}
        />
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-bold text-brandit-black tracking-tight mb-4">Funnel B2B</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FunnelCard title="Cotizaciones" count={funnel.cotizaciones.count} total={funnel.cotizaciones.total} />
          <FunnelCard title="Pedidos"      count={funnel.pedidos.count}      total={funnel.pedidos.total} />
          <FunnelCard title="Facturas"     count={funnel.facturas.count}     total={funnel.facturas.total} />
        </div>
      </section>
    </>
  );
}

type FunnelCardProps = {
  title: string;
  count: number;
  total: number;
};

function FunnelCard({ title, count, total }: FunnelCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-2xl font-bold text-brandit-black mt-1 tabular-nums">{count}</p>
      <p className="text-sm font-medium text-gray-600 mt-1 tabular-nums">{fmtMoney(total)}</p>
      <p className="text-xs text-gray-400 mt-2">del año</p>
    </div>
  );
}

type KpiCardProps = {
  title: string;
  value: string;
  subtitle: string;
  delta?: DeltaFormat;
};

function KpiCard({ title, value, subtitle, delta }: KpiCardProps) {
  const showSinComparativo = delta && delta.arrow === null && delta.displayValue === "—";

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-2xl font-bold text-brandit-black mt-1 tabular-nums">{value}</p>
      {delta && !showSinComparativo && (
        <p className={`text-sm font-medium mt-1 tabular-nums ${TONE_CLASS[delta.tone]}`}>
          {delta.arrow && <span className="mr-1">{delta.arrow}</span>}
          {delta.displayValue}
        </p>
      )}
      {showSinComparativo && (
        <p className="text-xs text-gray-400 mt-1">Sin comparativo</p>
      )}
      <p className="text-xs text-gray-400 mt-2">{subtitle}</p>
    </div>
  );
}
