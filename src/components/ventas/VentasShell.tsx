"use client";

import { useState } from "react";
import FrescuraBadge from "@/components/FrescuraBadge";
import OverviewSubtab from "./OverviewSubtab";
import DetalleMensualSubtab from "./DetalleMensualSubtab";
import VendedorasSubtab from "./VendedorasSubtab";
import ClientesSubtab from "./ClientesSubtab";

type Tab = "overview" | "detalle" | "vendedoras" | "clientes";
const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "detalle", label: "Detalle mensual" },
  { key: "vendedoras", label: "Vendedoras" },
  { key: "clientes", label: "Clientes" },
];

export default function VentasShell({ years, currentYear, currentMes }: { years: number[]; currentYear: number; currentMes: number }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [year, setYear] = useState(currentYear);

  // Para year en curso → mes actual; para año cerrado → 12 (todo el año).
  const mes = year === currentYear ? currentMes : 12;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-4xl font-extrabold text-brandit-black dark:text-white tracking-tight">Ventas</h1>
          <p className="text-sm text-gray-400 mt-1">Confecciones Boston · historia + Switch (venta neta)</p>
          <div className="mt-1.5"><FrescuraBadge endpoint="/api/ventas/frescura" /></div>
        </div>
        <select value={year} onChange={(e) => setYear(parseInt(e.target.value, 10))}
          className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 cursor-pointer">
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className="flex gap-1 mb-6 border-b border-gray-100 dark:border-gray-800 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${tab === t.key ? "border-brandit-orange text-brandit-black dark:text-white" : "border-transparent text-gray-400 hover:text-gray-600"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewSubtab year={year} mes={mes} />}
      {tab === "detalle" && <DetalleMensualSubtab year={year} mesInicial={mes} />}
      {tab === "vendedoras" && <VendedorasSubtab year={year} mesInicial={mes} />}
      {tab === "clientes" && <ClientesSubtab />}
    </div>
  );
}
