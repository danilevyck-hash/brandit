"use client";

import { useEffect, useState } from "react";
import type { VendedorasResp } from "./types";
import { fmtMoney, fmtMoneyCompact, fmtPct, fmtInt } from "@/lib/ventas/format";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
type Periodo = "mes" | "trimestre" | "ytd";

export default function VendedorasSubtab({ year, mesInicial }: { year: number; mesInicial: number }) {
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [mes, setMes] = useState(mesInicial);
  const [trim, setTrim] = useState(Math.ceil(mesInicial / 3));
  const [data, setData] = useState<VendedorasResp | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setMes(mesInicial); setTrim(Math.ceil(mesInicial / 3)); }, [mesInicial, year]);

  useEffect(() => {
    setData(null);
    setError(null);
    const qs = new URLSearchParams({ year: String(year), periodo });
    if (periodo === "mes") qs.set("mes", String(mes));
    if (periodo === "trimestre") qs.set("trimestre", String(trim));
    fetch(`/api/ventas/vendedoras?${qs.toString()}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok || d.error) throw new Error(d.error || `HTTP ${r.status}`);
        setData(d as VendedorasResp);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error"));
  }, [year, periodo, mes, trim]);

  const deltaTotal = data && data.ventas_total_prev > 0 ? (data.ventas_total - data.ventas_total_prev) / data.ventas_total_prev : null;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="inline-flex bg-gray-100 dark:bg-gray-800 rounded-full p-1">
          {(["mes", "trimestre", "ytd"] as Periodo[]).map((p) => (
            <button key={p} onClick={() => setPeriodo(p)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${periodo === p ? "bg-white dark:bg-gray-900 text-brandit-black dark:text-white shadow-sm" : "text-gray-500"}`}>
              {p === "ytd" ? "YTD" : p}
            </button>
          ))}
        </div>
        {periodo === "mes" && (
          <select value={mes} onChange={(e) => setMes(parseInt(e.target.value, 10))} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-1.5 text-xs">
            {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        )}
        {periodo === "trimestre" && (
          <select value={trim} onChange={(e) => setTrim(parseInt(e.target.value, 10))} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-1.5 text-xs">
            {[1, 2, 3, 4].map((q) => <option key={q} value={q}>Q{q}</option>)}
          </select>
        )}
      </div>

      {error && <div className="bg-red-50 border border-red-100 rounded-lg px-6 py-6 text-sm text-red-700">Error: {error}</div>}
      {!error && !data && <div className="bg-white rounded-lg border border-gray-200 px-6 py-16 text-center text-gray-400 text-sm shadow-sm">Cargando…</div>}

      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <Kpi title="Ventas del período" value={fmtMoney(data.ventas_total)} sub={deltaTotal != null ? `${fmtPct(deltaTotal)} vs período ant.` : "sin comparativo"} />
            <Kpi title="Tickets" value={fmtInt(data.tickets_total)} sub="documentos distintos" />
            <Kpi title="Vendedoras activas" value={String(data.total_vendedoras_periodo)} sub="con ventas en el período" />
            <Kpi title="Corte" value={data.fecha_corte ?? "—"} sub={data.es_periodo_parcial ? "período parcial" : "período completo"} />
          </div>

          {data.vendedoras.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 px-6 py-12 text-center text-gray-400 text-sm shadow-sm">Sin ventas con vendedor en el período.</div>
          ) : (
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm overflow-x-auto">
              <table className="w-full text-sm tabular-nums">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 text-xs font-semibold text-gray-500">
                    <th className="px-4 py-3 text-left">Vendedora</th>
                    <th className="px-3 py-3 text-right">Ventas</th>
                    <th className="px-3 py-3 text-right">Tickets</th>
                    <th className="px-3 py-3 text-right">Ticket prom</th>
                    <th className="px-3 py-3 text-right">Δ ventas</th>
                  </tr>
                </thead>
                <tbody>
                  {data.vendedoras.map((v) => (
                    <tr key={v.nombre} className="border-b border-gray-50 dark:border-gray-800/50">
                      <td className="px-4 py-2.5 text-gray-900 dark:text-gray-100 font-medium">
                        {v.top && <span className="mr-1" title="Top">⭐</span>}{v.nombre}
                      </td>
                      <td className="px-3 py-2.5 text-right text-gray-700 dark:text-gray-300">{fmtMoneyCompact(v.ventas)}</td>
                      <td className="px-3 py-2.5 text-right text-gray-600 dark:text-gray-400">{v.tickets}</td>
                      <td className="px-3 py-2.5 text-right text-gray-600 dark:text-gray-400">{fmtMoneyCompact(v.ticket_promedio)}</td>
                      <td className={`px-3 py-2.5 text-right ${v.delta_ventas_pct == null ? "text-gray-300" : v.delta_ventas_pct >= 0 ? "text-emerald-600" : "text-orange-600"}`}>
                        {v.delta_ventas_pct != null ? fmtPct(v.delta_ventas_pct) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-gray-400 mt-2">Δ vs período anterior, recortado al mismo día (same-period). Margen no se muestra por vendedor (el costo es a nivel día/mes).</p>
        </>
      )}
    </div>
  );
}

function Kpi({ title, value, sub }: { title: string; value: string; sub: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-xl font-bold text-brandit-black dark:text-white mt-1 tabular-nums">{value}</p>
      <p className="text-xs text-gray-400 mt-2">{sub}</p>
    </div>
  );
}
