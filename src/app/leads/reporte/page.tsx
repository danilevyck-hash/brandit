"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Lead = {
  id: string;
  vendedora: string;
  estado: string;
  estado_venta: string;
};

type VendedoraStats = {
  vendedora: string;
  total: number;
  prospectos: number;
  convertidos: number;
  no_convertidos: number;
  conversion: number;
};

function normalizeEstado(estado: string): string {
  if (estado === "interesado") return "prospecto";
  if (estado === "no_interesado") return "no_califica";
  return estado;
}

function normalizeEstadoVenta(ev: string): string {
  if (ev === "perdido") return "no_convertido";
  return ev;
}

export default function ReporteVendedorasPage() {
  const [stats, setStats] = useState<VendedoraStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState("");

  useEffect(() => {
    setRole(localStorage.getItem("brandit_role") || "");
  }, []);

  useEffect(() => {
    if (!role) return;
    if (role !== "admin" && role !== "secretaria") return;

    (async () => {
      setLoading(true);
      const res = await fetch("/api/leads");
      const leads: Lead[] = await res.json();

      const map = new Map<string, { total: number; prospectos: number; convertidos: number; no_convertidos: number }>();

      for (const l of leads) {
        const v = l.vendedora || "Sin asignar";
        if (!map.has(v)) map.set(v, { total: 0, prospectos: 0, convertidos: 0, no_convertidos: 0 });
        const s = map.get(v)!;
        s.total++;
        const ne = normalizeEstado(l.estado);
        const nev = normalizeEstadoVenta(l.estado_venta || "activo");
        if (ne === "prospecto" && nev === "activo") s.prospectos++;
        if (nev === "convertido") s.convertidos++;
        if (nev === "no_convertido") s.no_convertidos++;
      }

      const rows: VendedoraStats[] = Array.from(map.entries()).map(([vendedora, s]) => ({
        vendedora,
        ...s,
        conversion: s.convertidos + s.no_convertidos > 0
          ? (s.convertidos / (s.convertidos + s.no_convertidos)) * 100
          : 0,
      }));

      rows.sort((a, b) => b.conversion - a.conversion);
      setStats(rows);
      setLoading(false);
    })();
  }, [role]);

  if (role && role !== "admin" && role !== "secretaria") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <p className="text-gray-400 text-center">No tienes permiso para ver esta página</p>
      </div>
    );
  }

  const totals = stats.reduce(
    (acc, s) => ({
      total: acc.total + s.total,
      prospectos: acc.prospectos + s.prospectos,
      convertidos: acc.convertidos + s.convertidos,
      no_convertidos: acc.no_convertidos + s.no_convertidos,
    }),
    { total: 0, prospectos: 0, convertidos: 0, no_convertidos: 0 }
  );
  const totalConversion = totals.convertidos + totals.no_convertidos > 0
    ? (totals.convertidos / (totals.convertidos + totals.no_convertidos)) * 100
    : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-brandit-black tracking-tight">Reporte de vendedoras</h1>
          <p className="text-sm text-gray-400 mt-1">Rendimiento y conversiones por vendedora</p>
        </div>
        <Link href="/leads" className="text-sm text-brandit-orange hover:underline">
          Volver a leads
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-24 text-gray-300">Cargando...</div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-50 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left">
                <th className="px-4 py-3 text-xs font-semibold text-brandit-black">Vendedora</th>
                <th className="px-3 py-3 text-xs font-semibold text-brandit-black text-right">Total</th>
                <th className="px-3 py-3 text-xs font-semibold text-green-600 text-right">Prospectos</th>
                <th className="px-3 py-3 text-xs font-semibold text-green-700 text-right">Convertidos</th>
                <th className="px-3 py-3 text-xs font-semibold text-red-500 text-right">No Conv.</th>
                <th className="px-4 py-3 text-xs font-semibold text-brandit-orange text-right">% Conv.</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.vendedora} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium text-gray-900">{s.vendedora}</td>
                  <td className="px-3 py-3 text-right text-gray-600 tabular-nums">{s.total}</td>
                  <td className="px-3 py-3 text-right text-gray-600 tabular-nums">{s.prospectos}</td>
                  <td className="px-3 py-3 text-right text-green-700 tabular-nums">{s.convertidos}</td>
                  <td className="px-3 py-3 text-right text-red-500 tabular-nums">{s.no_convertidos}</td>
                  <td className="px-4 py-3 text-right font-semibold text-brandit-orange tabular-nums">
                    {s.conversion.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-brandit-orange font-bold text-brandit-black">
                <td className="px-4 py-3">Totales</td>
                <td className="px-3 py-3 text-right tabular-nums">{totals.total}</td>
                <td className="px-3 py-3 text-right tabular-nums">{totals.prospectos}</td>
                <td className="px-3 py-3 text-right text-green-700 tabular-nums">{totals.convertidos}</td>
                <td className="px-3 py-3 text-right text-red-500 tabular-nums">{totals.no_convertidos}</td>
                <td className="px-4 py-3 text-right text-brandit-orange tabular-nums">{totalConversion.toFixed(1)}%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
