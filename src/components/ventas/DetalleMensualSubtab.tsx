"use client";

import { useEffect, useState } from "react";
import type { DetalleMensual } from "./types";
import { fmtMoney, fmtMoneyCompact, fmtPct, fmtInt } from "@/lib/ventas/format";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export default function DetalleMensualSubtab({ year, mesInicial }: { year: number; mesInicial: number }) {
  const [mes, setMes] = useState(mesInicial);
  const [data, setData] = useState<DetalleMensual | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setMes(mesInicial); }, [mesInicial, year]);

  useEffect(() => {
    setData(null);
    setError(null);
    fetch(`/api/ventas/detalle-mensual?year=${year}&mes=${mes}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok || d.error) throw new Error(d.error || `HTTP ${r.status}`);
        setData(d as DetalleMensual);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error"));
  }, [year, mes]);

  const momPct = data && data.mes_anterior.tiene_data && data.mes_anterior.ventas > 0
    ? (data.totales.ventas - data.mes_anterior.ventas) / data.mes_anterior.ventas : null;
  const yoyPct = data && data.yoy.tiene_data && data.yoy.ventas > 0
    ? (data.totales.ventas - data.yoy.ventas) / data.yoy.ventas : null;
  const maxVenta = data ? Math.max(1, ...data.dias.map((d) => d.ventas)) : 1;

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-4">
        {MESES.map((label, i) => (
          <button key={label} onClick={() => setMes(i + 1)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${mes === i + 1 ? "bg-brandit-orange text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200"}`}>
            {label}
          </button>
        ))}
      </div>

      {error && <div className="bg-red-50 border border-red-100 rounded-lg px-6 py-6 text-sm text-red-700">Error: {error}</div>}
      {!error && !data && <div className="bg-white rounded-lg border border-gray-200 px-6 py-16 text-center text-gray-400 text-sm shadow-sm">Cargando…</div>}

      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi title={`Ventas ${data.mes_label}`} value={fmtMoney(data.totales.ventas)} sub={`${fmtInt(data.totales.n_tickets)} tickets`} />
            <Kpi title="Utilidad" value={data.totales.margen != null ? fmtMoney(data.totales.utilidad) : "—"} sub={data.totales.margen != null ? `margen ${fmtPct(data.totales.margen)}` : "sin costo"} />
            <Kpi title="Ticket promedio" value={fmtMoney(data.totales.ticket_promedio)} sub="ventas / tickets" />
            <Kpi title="Proyección cierre" value={data.totales.proyeccion_cierre != null ? fmtMoney(data.totales.proyeccion_cierre) : "—"} sub={data.is_mes_actual ? `al día ${data.dia_actual}` : "mes cerrado"} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <Comp title="vs mes anterior" pct={momPct} ventas={data.mes_anterior.ventas} tiene={data.mes_anterior.tiene_data} />
            <Comp title="vs mismo mes año anterior" pct={yoyPct} ventas={data.yoy.ventas} tiene={data.yoy.tiene_data} />
          </div>

          {(data.mejor_dia || data.peor_dia) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              {data.mejor_dia && <Extremo title="Mejor día" fecha={data.mejor_dia.fecha} ventas={data.mejor_dia.ventas} tone="text-emerald-600" />}
              {data.peor_dia && <Extremo title="Día más bajo" fecha={data.peor_dia.fecha} ventas={data.peor_dia.ventas} tone="text-orange-600" />}
            </div>
          )}

          <section className="mt-8">
            <h3 className="text-sm font-bold text-brandit-black dark:text-white mb-3">Día por día</h3>
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm overflow-x-auto">
              <table className="w-full text-sm tabular-nums">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 text-xs font-semibold text-gray-500">
                    <th className="px-4 py-2.5 text-left">Día</th>
                    <th className="px-3 py-2.5 text-right">Ventas</th>
                    <th className="px-3 py-2.5 text-left w-1/3">&nbsp;</th>
                    <th className="px-3 py-2.5 text-right">Tickets</th>
                    <th className="px-3 py-2.5 text-right">Utilidad</th>
                    <th className="px-3 py-2.5 text-right">Mes ant.</th>
                  </tr>
                </thead>
                <tbody>
                  {data.dias.map((d) => (
                    <tr key={d.dia} className="border-b border-gray-50 dark:border-gray-800/50">
                      <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{d.dia}</td>
                      <td className="px-3 py-2 text-right text-gray-900 dark:text-gray-100 font-medium">{d.ventas ? fmtMoneyCompact(d.ventas) : "—"}</td>
                      <td className="px-3 py-2"><div className="h-2 rounded-full bg-brandit-orange/70" style={{ width: `${Math.max(0, (d.ventas / maxVenta) * 100)}%` }} /></td>
                      <td className="px-3 py-2 text-right text-gray-500">{d.n_tickets || "—"}</td>
                      <td className="px-3 py-2 text-right text-gray-500">{d.utilidad != null && d.ventas ? fmtMoneyCompact(d.utilidad) : "—"}</td>
                      <td className="px-3 py-2 text-right text-gray-400">{d.ventas_mes_anterior ? fmtMoneyCompact(d.ventas_mes_anterior) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-8">
            <h3 className="text-sm font-bold text-brandit-black dark:text-white mb-3">Promedio por día de la semana</h3>
            <div className="grid grid-cols-7 gap-2">
              {data.heatmap_dia_semana.map((h) => (
                <div key={h.dow} className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-3 text-center shadow-sm">
                  <p className="text-xs text-gray-400">{h.dow_label}</p>
                  <p className="text-sm font-semibold text-brandit-black dark:text-white mt-1 tabular-nums">{h.count_dias > 0 ? fmtMoneyCompact(h.ventas_promedio) : "—"}</p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Kpi({ title, value, sub }: { title: string; value: string; sub: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-2xl font-bold text-brandit-black dark:text-white mt-1 tabular-nums">{value}</p>
      <p className="text-xs text-gray-400 mt-2">{sub}</p>
    </div>
  );
}
function Comp({ title, pct, ventas, tiene }: { title: string; pct: number | null; ventas: number; tiene: boolean }) {
  const tone = pct == null ? "text-gray-400" : pct >= 0 ? "text-emerald-600" : "text-orange-600";
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
      <p className="text-sm text-gray-500">{title}</p>
      <p className={`text-xl font-bold mt-1 tabular-nums ${tone}`}>{pct != null ? fmtPct(pct) : "—"}</p>
      <p className="text-xs text-gray-400 mt-2">{tiene ? `base ${fmtMoneyCompact(ventas)}` : "sin data comparable"}</p>
    </div>
  );
}
function Extremo({ title, fecha, ventas, tone }: { title: string; fecha: string; ventas: number; tone: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
      <p className="text-sm text-gray-500">{title}</p>
      <p className={`text-xl font-bold mt-1 tabular-nums ${tone}`}>{fmtMoney(ventas)}</p>
      <p className="text-xs text-gray-400 mt-2">{fecha}</p>
    </div>
  );
}
