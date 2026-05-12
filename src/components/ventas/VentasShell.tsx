"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { VentasResumen } from "./types";
import UploadButton, { type UploadResponse } from "./UploadButton";
import ResumenView from "./ResumenView";
import ClientesView from "./ClientesView";

type Props = {
  data: VentasResumen;
  years: number[];
  year: number;
};

type Tab = "resumen" | "clientes";

export default function VentasShell({ data, years, year }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("resumen");
  const [lastResult, setLastResult] = useState<UploadResponse | null>(null);

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    router.push(`/ventas?year=${e.target.value}`);
  };

  const handleUploadResult = (r: UploadResponse) => {
    setLastResult(r);
    // Re-fetch del Server Component para que ResumenView vea data fresh.
    router.refresh();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-4xl font-extrabold text-brandit-black tracking-tight">Ventas</h1>
          <p className="text-sm text-gray-400 mt-1">Cotizaciones, pedidos, facturas y notas de Confecciones Boston</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={year}
            onChange={handleYearChange}
            className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-700 hover:border-gray-300 transition-colors cursor-pointer"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <UploadButton onResult={handleUploadResult} />
        </div>
      </div>

      {lastResult?.ok && lastResult.stats && (
        <UploadResultBanner result={lastResult} />
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-100">
        <button
          onClick={() => setTab("resumen")}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
            tab === "resumen"
              ? "border-brandit-orange text-brandit-black"
              : "border-transparent text-gray-400 hover:text-gray-600"
          }`}
        >
          Resumen
        </button>
        <button
          onClick={() => setTab("clientes")}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
            tab === "clientes"
              ? "border-brandit-orange text-brandit-black"
              : "border-transparent text-gray-400 hover:text-gray-600"
          }`}
        >
          Clientes
        </button>
      </div>

      {tab === "resumen" ? <ResumenView data={data} /> : <ClientesView />}
    </div>
  );
}

function UploadResultBanner({ result }: { result: UploadResponse }) {
  const stats = result.stats!;
  const items = [
    { label: "facturas",      count: stats.facturas },
    { label: "notas crédito", count: stats.notasCredito },
    { label: "notas débito",  count: stats.notasDebito },
    { label: "tiquetes",      count: stats.tiquetes },
    { label: "transacciones", count: stats.transacciones },
    { label: "cotizaciones",  count: stats.cotizaciones },
    { label: "pedidos",       count: stats.pedidos },
  ].filter(i => i.count > 0);
  const invalidos =
    (stats.invalidTipo ?? 0) + (stats.invalidFecha ?? 0) + (stats.invalidCliente ?? 0);

  return (
    <div className="mb-6 bg-green-50 border border-green-100 rounded-xl px-5 py-4 text-sm">
      <p className="font-semibold text-green-700 mb-2">
        Carga completada · {result.inserted ?? 0} comprobantes
      </p>
      {items.length > 0 && (
        <p className="text-green-600">
          {items.map(i => `${i.count} ${i.label}`).join(" · ")}
        </p>
      )}
      <p className="text-green-600 mt-1">
        {result.clientes_sincronizados ?? 0} clientes sincronizados
      </p>
      {invalidos > 0 && (
        <p className="text-xs text-green-500 mt-1">
          Filas descartadas: tipo inválido {stats.invalidTipo ?? 0} ·
          fecha inválida {stats.invalidFecha ?? 0} ·
          cliente vacío {stats.invalidCliente ?? 0}.
        </p>
      )}
    </div>
  );
}
