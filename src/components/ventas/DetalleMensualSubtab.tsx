"use client";

import { useEffect, useState } from "react";
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import type { DetalleMensual } from "./types";
import { fmtMoney, fmtMoneyCompact, fmtPct, fmtInt } from "@/lib/ventas/format";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export default function DetalleMensualSubtab({ year, mesInicial }: { year: number; mesInicial: number }) {
  const [mes, setMes] = useState(mesInicial);
  const [data, setData] = useState<DetalleMensual | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setMes(mesInicial); }, [mesInicial, year]);

  useEffect(() => {
    setData(null); setError(null);
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
  const peakDia = data ? Math.max(0, ...data.dias.map((d) => d.ventas)) : 0;
  const peakDow = data ? Math.max(0, ...data.heatmap_dia_semana.map((h) => h.ventas_promedio)) : 0;
  const chartData = data?.dias.map((d) => ({ dia: d.dia, ventas: d.ventas, mesAnterior: d.ventas_mes_anterior })) ?? [];

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

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            <Comp title="vs mes anterior" pct={momPct} ventas={data.mes_anterior.ventas} tiene={data.mes_anterior.tiene_data} />
            <Comp title="vs año anterior" pct={yoyPct} ventas={data.yoy.ventas} tiene={data.yoy.tiene_data} />
            {data.mejor_dia && <Extremo title="Mejor día" fecha={data.mejor_dia.fecha} ventas={data.mejor_dia.ventas} tone="text-emerald-600" />}
            {data.peor_dia && <Extremo title="Día más bajo" fecha={data.peor_dia.fecha} ventas={data.peor_dia.ventas} tone="text-orange-600" />}
          </div>

          <section className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-brandit-black dark:text-white">Ventas por día</h3>
              <div className="flex items-center gap-3 text-[11px] text-gray-500">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-brandit-orange" /> este mes</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-gray-400" /> mes anterior</span>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm p-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                  <XAxis dataKey="dia" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} interval={1} />
                  <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={48} tickFormatter={(v) => fmtMoneyCompact(Number(v))} />
                  <Tooltip formatter={(v, n) => [fmtMoney(Number(v)), n === "ventas" ? "Este mes" : "Mes anterior"]} labelFormatter={(l) => `Día ${l}`} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  <Bar dataKey="ventas" radius={[3, 3, 0, 0]} maxBarSize={22}>
                    {chartData.map((d, idx) => (
                      <Cell key={idx} fill={peakDia > 0 && d.ventas === peakDia ? "#ea580c" : "#F97316"} />
                    ))}
                  </Bar>
                  <Line type="monotone" dataKey="mesAnterior" stroke="#9ca3af" strokeWidth={1.5} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="mt-8">
            <h3 className="text-sm font-bold text-brandit-black dark:text-white mb-3">Promedio por día de la semana</h3>
            <div className="grid grid-cols-7 gap-2">
              {data.heatmap_dia_semana.map((h) => {
                const intensity = peakDow > 0 ? h.ventas_promedio / peakDow : 0;
                return (
                  <div key={h.dow} className="rounded-lg border border-gray-200 dark:border-gray-800 p-3 text-center"
                    style={{ backgroundColor: h.count_dias > 0 ? `rgba(20,184,166,${0.08 + intensity * 0.4})` : undefined }}>
                    <p className="text-xs text-gray-500">{h.dow_label}</p>
                    <p className="text-sm font-semibold text-brandit-black dark:text-white mt-1 tabular-nums">{h.count_dias > 0 ? fmtMoneyCompact(h.ventas_promedio) : "—"}</p>
                  </div>
                );
              })}
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
