"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Guia } from "./types";
import { fmtGuia, fmtFechaCorta } from "./types";

const BADGE: Record<string, string> = {
  "Pendiente Bodega": "bg-amber-50 text-amber-700",
  "Completada": "bg-green-50 text-green-700",
  "Despachada": "bg-green-50 text-green-700",
  "Rechazada": "bg-red-50 text-red-700",
};

function grupoTemporal(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00-05:00`);
  const hoy = new Date();
  const diff = Math.floor((hoy.getTime() - d.getTime()) / 86400000);
  if (diff <= 0) return "Hoy";
  if (diff === 1) return "Ayer";
  if (diff <= 7) return "Esta semana";
  if (diff <= 31) return "Este mes";
  return "Más antiguas";
}
const ORDEN_GRUPOS = ["Hoy", "Ayer", "Esta semana", "Este mes", "Más antiguas"];

export default function GuiasList() {
  const router = useRouter();
  const [guias, setGuias] = useState<Guia[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/guias")
      .then(async (r) => { const d = await r.json(); if (!r.ok || d.error) throw new Error(d.error || `HTTP ${r.status}`); setGuias(d as Guia[]); })
      .catch((e) => setError(e instanceof Error ? e.message : "Error"));
  }, []);

  const grupos = new Map<string, Guia[]>();
  for (const g of guias ?? []) {
    const k = grupoTemporal(g.fecha);
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k)!.push(g);
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-4xl font-extrabold text-brandit-black dark:text-white tracking-tight">Guías de transporte</h1>
          <p className="text-sm text-gray-400 mt-1">Despachos y entregas de Confecciones Boston</p>
        </div>
        <button onClick={() => router.push("/guias/nueva")} className="bg-brandit-orange text-white font-semibold px-6 py-3 rounded-xl text-sm hover:bg-brandit-orange/90 min-h-[44px]">+ Nueva guía</button>
      </div>

      {error && <div className="bg-red-50 border border-red-100 rounded-lg px-6 py-6 text-sm text-red-700">Error: {error}</div>}
      {!error && !guias && <div className="bg-white rounded-lg border border-gray-200 px-6 py-16 text-center text-gray-400 text-sm shadow-sm">Cargando…</div>}
      {guias && guias.length === 0 && <div className="bg-white rounded-lg border border-gray-200 px-6 py-16 text-center text-gray-400 text-sm shadow-sm">No hay guías todavía. Creá la primera.</div>}

      {ORDEN_GRUPOS.filter((k) => grupos.has(k)).map((k) => (
        <section key={k} className="mb-6">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{k}</h2>
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 text-xs font-semibold text-gray-500">
                  <th className="px-4 py-3 text-left">N°</th>
                  <th className="px-3 py-3 text-left">Fecha</th>
                  <th className="px-3 py-3 text-left">Transportista</th>
                  <th className="px-3 py-3 text-right">Items</th>
                  <th className="px-3 py-3 text-right">Bultos</th>
                  <th className="px-3 py-3 text-right">Monto</th>
                  <th className="px-3 py-3 text-left">Estado</th>
                </tr>
              </thead>
              <tbody>
                {grupos.get(k)!.map((g) => (
                  <tr key={g.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50/60 dark:hover:bg-gray-800/40 cursor-pointer transition-colors"
                    onClick={() => router.push(`/guias/${g.id}`)}>
                    <td className="px-4 py-2.5 font-medium text-brandit-black dark:text-gray-100"><Link href={`/guias/${g.id}`} onClick={(e) => e.stopPropagation()} className="hover:text-brandit-orange">{fmtGuia(g.numero)}</Link></td>
                    <td className="px-3 py-2.5 text-gray-600 dark:text-gray-400">{fmtFechaCorta(g.fecha)}</td>
                    <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{g.transportista || "—"}</td>
                    <td className="px-3 py-2.5 text-right text-gray-500">{g.item_count ?? g.guia_items?.length ?? "—"}</td>
                    <td className="px-3 py-2.5 text-right text-gray-700 dark:text-gray-300">{g.total_bultos ?? "—"}</td>
                    <td className="px-3 py-2.5 text-right text-gray-600 dark:text-gray-400">{g.monto_total ? `$${Number(g.monto_total).toFixed(2)}` : "—"}</td>
                    <td className="px-3 py-2.5"><span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-medium ${BADGE[g.estado] ?? "bg-gray-100 text-gray-600"}`}>{g.estado}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
