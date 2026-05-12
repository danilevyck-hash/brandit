"use client";

import { useState } from "react";
import type { VentasResumen, MonthlySeries } from "./types";
import { fmtMoney, fmtPct, MONTHS, QUARTERS, monthsToQuarters } from "@/lib/ventas/format";
import { formatDelta, type DeltaFormat } from "@/lib/ventas/formatDelta";
import HeatmapTable from "./HeatmapTable";

// TODO(naming-cleanup): los campos `ventas2026/ventas2025/utilidad2026/utilidad2025`
// en VentasResumen son legacy names heredados de fashiongr. En realidad representan
// {current, prev} del year seleccionado, NO años 2026/2025 literales. Si seleccionás
// year=2024, `ventas2026` contiene data de 2024 y `ventas2025` de 2023. Refactor a
// `ventasCur/ventasPrev/utilidadCur/utilidadPrev` en sprint separado.

type Props = { data: VentasResumen };

const METRICS = ["Ventas", "Utilidad"] as const;
const PERIODS = ["Mensual", "Trimestral"] as const;
type Metric = typeof METRICS[number];
type Period = typeof PERIODS[number];

const TONE_CLASS: Record<DeltaFormat["tone"], string> = {
  emerald: "text-emerald-600",
  orange:  "text-orange-600",
  stone:   "text-gray-400",
};

export default function ResumenView({ data }: Props) {
  const [metric, setMetric] = useState<Metric>("Ventas");
  const [period, setPeriod] = useState<Period>("Mensual");

  const { kpis, funnel, year, mesActual } = data;
  const ventasDelta   = formatDelta(kpis.ventasYTD,   kpis.ventasPrevYTD);
  const utilidadDelta = formatDelta(kpis.utilidadYTD, kpis.utilidadPrevYTD);
  const margenDelta   = formatDelta(kpis.margenYTD,   kpis.margenPrevYTD);

  const metaConfigured = kpis.metaAnual > 0;
  const avancePctRaw   = metaConfigured ? (kpis.ventasYTD / kpis.metaAnual) * 100 : 0;
  const avanceDisplay  = metaConfigured ? `${Math.round(avancePctRaw)}%` : "—";
  const avanceSubtitle = metaConfigured
    ? `Meta: ${fmtMoney(kpis.metaAnual)}`
    : "Meta no configurada";

  // Series del heatmap según toggle Metric (Ventas → subtotal, Utilidad → utilidad).
  // Los nombres `ventas2026/ventas2025` son legacy — ver TODO arriba.
  const currentMonths: MonthlySeries = metric === "Ventas" ? data.ventas2026 : data.utilidad2026;
  const prevMonths:    MonthlySeries = metric === "Ventas" ? data.ventas2025 : data.utilidad2025;

  // Si Trimestral, agregamos 12→4. monthsToQuarters: parcial = suma de no-null,
  // todos null → null. Opción B (parcial visible) la implementa el masking via
  // maxComparableIndex en HeatmapTable, no acá.
  const current = period === "Mensual" ? currentMonths : monthsToQuarters(currentMonths);
  const prev    = period === "Mensual" ? prevMonths    : monthsToQuarters(prevMonths);
  const labels  = period === "Mensual" ? MONTHS : QUARTERS;

  // Same-period strict: hasta qué index hay comparativo válido.
  //   Mensual: mesActual=4 → indices 0..3 (Ene..Abr) comparables.
  //   Trimestral: solo quarters cuyo último mes (q*3+3) <= mesActual.
  //     mesActual=3 → Q1 sí (último mes 3). Q2 no.
  //     mesActual=4 → Q1 sí. Q2 no (último mes 6 > 4).
  //     mesActual=6 → Q1+Q2. Q3 no.
  //   maxComparableIndex Trimestral = floor(mesActual / 3) - 1.
  // Si mesActual = 0 (year sin data) → maxComparableIndex = -1 → tabla muestra "—".
  const maxComparableIndex = period === "Mensual"
    ? mesActual - 1
    : Math.floor(mesActual / 3) - 1;

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

      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-bold text-brandit-black tracking-tight">
            {metric} · {period}
          </h2>
          <div className="flex items-center gap-2">
            <SegmentedPills value={metric} onChange={setMetric} options={METRICS} />
            <SegmentedPills value={period} onChange={setPeriod} options={PERIODS} />
          </div>
        </div>
        <HeatmapTable
          labels={labels}
          currentLabel={String(year)}
          prevLabel={String(year - 1)}
          current={current}
          prev={prev}
          maxComparableIndex={maxComparableIndex}
        />
      </section>
    </>
  );
}

function SegmentedPills<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly T[];
}) {
  return (
    <div className="inline-flex bg-gray-100 rounded-full p-1">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
            value === opt
              ? "bg-white text-brandit-black shadow-sm"
              : "text-gray-500 hover:text-brandit-black"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
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
