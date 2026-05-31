"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { ClientesResp, Cliente } from "./types";
import { fmtMoney, fmtMoneyCompact, fmtInt } from "@/lib/ventas/format";

type Rango = "12m" | "6m" | "3m" | "1m" | "ytd";
const RANGOS: { key: Rango; label: string }[] = [
  { key: "ytd", label: "Año actual" },
  { key: "12m", label: "12 meses" },
  { key: "6m", label: "6 meses" },
  { key: "3m", label: "3 meses" },
  { key: "1m", label: "Último mes" },
];

function rangoFechas(r: Rango): { desde: string; hasta: string } {
  const hoy = new Date();
  const hasta = hoy.toISOString().slice(0, 10);
  if (r === "ytd") return { desde: `${hoy.getFullYear()}-01-01`, hasta };
  const meses = r === "12m" ? 12 : r === "6m" ? 6 : r === "3m" ? 3 : 1;
  const d = new Date(hoy.getFullYear(), hoy.getMonth() - meses, hoy.getDate());
  return { desde: d.toISOString().slice(0, 10), hasta };
}

export default function ClientesSubtab() {
  const [rango, setRango] = useState<Rango>("ytd");
  const [data, setData] = useState<ClientesResp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const { desde, hasta } = useMemo(() => rangoFechas(rango), [rango]);

  useEffect(() => {
    setData(null); setError(null); setExpanded(null);
    fetch(`/api/ventas/clientes?fecha_inicio=${desde}&fecha_fin=${hasta}&limit=50`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok || d.error) throw new Error(d.error || `HTTP ${r.status}`);
        setData(d as ClientesResp);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error"));
  }, [desde, hasta]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1 mb-4">
        {RANGOS.map((r) => (
          <button key={r.key} onClick={() => setRango(r.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${rango === r.key ? "bg-brandit-orange text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200"}`}>
            {r.label}
          </button>
        ))}
      </div>

      {error && <div className="bg-red-50 border border-red-100 rounded-lg px-6 py-6 text-sm text-red-700">Error: {error}</div>}
      {!error && !data && <div className="bg-white rounded-lg border border-gray-200 px-6 py-16 text-center text-gray-400 text-sm shadow-sm">Cargando…</div>}

      {data && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <Kpi title="Clientes recurrentes" value={fmtInt(data.total_clientes)} sub="≥2 tickets en el rango" />
            <Kpi title="Ventas (top 50)" value={fmtMoney(data.total_ventas)} sub="de los recurrentes" />
            <Kpi title="Tickets" value={fmtInt(data.total_tickets)} sub="de los recurrentes" />
          </div>

          {data.clientes.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 px-6 py-12 text-center text-gray-400 text-sm shadow-sm">Sin clientes recurrentes en el rango.</div>
          ) : (
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
              <table className="w-full text-sm tabular-nums">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 text-xs font-semibold text-gray-500">
                    <th className="px-4 py-3 text-left">#</th>
                    <th className="px-4 py-3 text-left">Cliente</th>
                    <th className="px-3 py-3 text-right">Total</th>
                    <th className="px-3 py-3 text-right">Tickets</th>
                    <th className="px-3 py-3 text-right">Ticket prom</th>
                    <th className="px-3 py-3 text-right">Última</th>
                    <th className="px-3 py-3 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {data.clientes.map((c, i) => {
                    const open = expanded === c.nombre;
                    return (
                      <FilaCliente key={c.nombre} c={c} i={i} open={open} onClick={() => setExpanded(open ? null : c.nombre)} />
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-gray-400 mt-2">Recurrentes = ≥2 tickets, excluye CONTADO / CONSUMIDOR FINAL. Click en una fila para ver su histórico mensual.</p>
        </>
      )}
    </div>
  );
}

function FilaCliente({ c, i, open, onClick }: { c: Cliente; i: number; open: boolean; onClick: () => void }) {
  const activos = c.meses.filter((m) => m.ventas > 0).length;
  const promedio = activos > 0 ? c.total_ytd / activos : 0;
  const chartData = c.meses.map((m) => ({ label: m.mes_label, ventas: m.ventas }));
  const peak = Math.max(0, ...c.meses.map((m) => m.ventas));

  return (
    <>
      <tr onClick={onClick} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50/60 dark:hover:bg-gray-800/40 cursor-pointer transition-colors">
        <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
        <td className="px-4 py-2.5 text-gray-900 dark:text-gray-100 font-medium">{c.nombre}</td>
        <td className="px-3 py-2.5 text-right text-gray-700 dark:text-gray-300">{fmtMoneyCompact(c.total_ytd)}</td>
        <td className="px-3 py-2.5 text-right text-gray-600 dark:text-gray-400">{c.tickets_ytd}</td>
        <td className="px-3 py-2.5 text-right text-gray-600 dark:text-gray-400">{fmtMoneyCompact(c.ticket_prom)}</td>
        <td className="px-3 py-2.5 text-right text-gray-500">{c.ultima_compra ?? "—"}</td>
        <td className="px-3 py-2.5 text-gray-400 text-center">{open ? "▾" : "▸"}</td>
      </tr>
      {open && (
        <tr className="bg-stone-50/60 dark:bg-gray-800/30 border-b border-gray-100 dark:border-gray-800">
          <td colSpan={7} className="px-4 py-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3 text-xs">
              <Stat label="Total" value={fmtMoney(c.total_ytd)} />
              <Stat label="Promedio mensual" value={fmtMoney(promedio)} />
              <Stat label="Meses activos" value={`${activos}/${c.meses.length}`} />
              <Stat label="Última compra" value={c.ultima_compra ?? "—"} />
            </div>
            <div className="h-24 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} interval={0} />
                  <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} formatter={(v) => fmtMoney(Number(v))} labelStyle={{ fontSize: 11 }} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  <Bar dataKey="ventas" radius={[3, 3, 0, 0]}>
                    {chartData.map((d, idx) => (
                      <Cell key={idx} fill={peak > 0 && d.ventas === peak ? "#F97316" : "#14b8a6"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800 px-3 py-2">
      <p className="text-gray-400">{label}</p>
      <p className="font-semibold text-brandit-black dark:text-white mt-0.5 tabular-nums">{value}</p>
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
