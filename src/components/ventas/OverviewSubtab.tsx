"use client";

import { useEffect, useState } from "react";
import type { Overview } from "./types";
import { fmtMoney, fmtMoneyCompact, fmtPct, fmtInt } from "@/lib/ventas/format";
import { formatDeltaRatio } from "@/lib/ventas/formatDelta";

const TONE: Record<string, string> = { emerald: "text-emerald-600", orange: "text-orange-600", stone: "text-gray-400" };

export default function OverviewSubtab({ year, mes }: { year: number; mes: number }) {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    fetch(`/api/ventas/overview?year=${year}&mes=${mes}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok || d.error) throw new Error(d.error || `HTTP ${r.status}`);
        setData(d as Overview);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error"));
  }, [year, mes]);

  if (error) return <div className="bg-red-50 border border-red-100 rounded-lg px-6 py-6 text-sm text-red-700">Error: {error}</div>;
  if (!data) return <div className="bg-white rounded-lg border border-gray-200 px-6 py-16 text-center text-gray-400 text-sm shadow-sm">Cargando…</div>;

  const margenDelta = data.margen != null && data.margenPrev != null ? formatDeltaRatio(data.margen - data.margenPrev) : null;

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi title={`Ventas YTD ${year}`} value={fmtMoney(data.ytdVentas)} subtitle="venta neta acumulada" />
        <Kpi title="Tickets YTD" value={fmtInt(data.ytdTickets)} subtitle="documentos distintos" />
        <Kpi title="Ticket promedio" value={fmtMoney(data.ticketProm)} subtitle="ventas / tickets" />
        <Kpi
          title="Margen YTD"
          value={data.margen != null ? fmtPct(data.margen) : "—"}
          subtitle={data.margen != null ? `utilidad ${fmtMoneyCompact(data.ytdUtilidad)}` : "sin costo"}
          delta={margenDelta ? { txt: margenDelta.displayValue, tone: margenDelta.tone, arrow: margenDelta.arrow } : null}
        />
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-bold text-brandit-black dark:text-white tracking-tight mb-3">Meses · {year}</h2>
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-xs font-semibold text-gray-500">
                <th className="px-4 py-3 text-left">Mes</th>
                <th className="px-3 py-3 text-right">Ventas</th>
                <th className="px-3 py-3 text-right">Tickets</th>
                <th className="px-3 py-3 text-right">Ticket prom</th>
                <th className="px-3 py-3 text-right">vs año ant.</th>
              </tr>
            </thead>
            <tbody>
              {data.meses.map((m) => {
                const d = m.vs2025 != null ? formatDeltaRatio(m.vs2025) : null;
                return (
                  <tr key={m.mes} className="border-b border-gray-50 dark:border-gray-800/50">
                    <td className="px-4 py-2.5 text-gray-900 dark:text-gray-100 font-medium">
                      {m.mes}{m.es_periodo_parcial && <span className="ml-1 text-[10px] text-brandit-orange">parcial</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-700 dark:text-gray-300">{fmtMoneyCompact(m.ventas)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-600 dark:text-gray-400">{m.tickets}</td>
                    <td className="px-3 py-2.5 text-right text-gray-600 dark:text-gray-400">{m.tickets > 0 ? fmtMoneyCompact(m.ticketProm) : "—"}</td>
                    <td className={`px-3 py-2.5 text-right ${d ? TONE[d.tone] : "text-gray-300"}`}>
                      {d ? <>{d.arrow && <span className="mr-1">{d.arrow}</span>}{d.displayValue}</> : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400 mt-2">El mes parcial compara contra el mismo rango de días del año anterior (same-period).</p>
      </section>
    </div>
  );
}

function Kpi({ title, value, subtitle, delta }: { title: string; value: string; subtitle: string; delta?: { txt: string; tone: string; arrow: string | null } | null }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-2xl font-bold text-brandit-black dark:text-white mt-1 tabular-nums">{value}</p>
      {delta && (
        <p className={`text-sm font-medium mt-1 tabular-nums ${TONE[delta.tone]}`}>
          {delta.arrow && <span className="mr-1">{delta.arrow}</span>}{delta.txt} <span className="text-gray-400 font-normal">vs año ant.</span>
        </p>
      )}
      <p className="text-xs text-gray-400 mt-2">{subtitle}</p>
    </div>
  );
}
