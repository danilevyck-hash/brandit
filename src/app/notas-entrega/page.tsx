"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type Nota = {
  id: number;
  numero: string;
  fecha: string;
  cliente: string;
  estado: string;
  items_count: number;
  total_cantidad: number;
};

const TABS = [
  { key: "todas", label: "Todas" },
  { key: "abierta", label: "Abiertas" },
  { key: "aprobada", label: "Aprobadas" },
  { key: "cerrada", label: "Cerradas" },
];

function estadoBadge(estado: string) {
  switch (estado) {
    case "abierta":
      return "bg-gray-100 text-gray-600";
    case "aprobada":
      return "bg-brandit-orange/10 text-brandit-orange";
    case "cerrada":
      return "bg-green-100 text-green-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

function formatFecha(d: string) {
  if (!d) return "-";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

export default function NotasEntregaPage() {
  const [notas, setNotas] = useState<Nota[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("todas");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (tab !== "todas") params.set("estado", tab);
    const res = await fetch(`/api/notas-entrega?${params}`);
    const data = await res.json();
    setNotas(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [search, tab]);

  useEffect(() => {
    load();
  }, [load]);

  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, tab]);

  const kpiCounts = {
    total: notas.length,
    abiertas: notas.filter((n) => n.estado === "abierta").length,
    aprobadas: notas.filter((n) => n.estado === "aprobada").length,
    cerradas: notas.filter((n) => n.estado === "cerrada").length,
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Entregas</p>
          <h1 className="text-3xl font-bold text-brandit-black tracking-tight">Notas de Entrega</h1>
          <p className="text-sm text-gray-400 mt-1">Control de entregas a clientes</p>
        </div>
        <Link
          href="/notas-entrega/nueva"
          className="bg-brandit-orange text-white rounded-xl px-6 py-2.5 text-sm font-medium hover:bg-brandit-orange/90 transition-colors min-h-[44px] flex items-center"
        >
          + Nueva Nota
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-2">Total</p>
          <p className="text-2xl font-bold text-brandit-black">{kpiCounts.total}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-2">Abiertas</p>
          <p className="text-2xl font-bold text-gray-500">{kpiCounts.abiertas}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-2">Aprobadas</p>
          <p className="text-2xl font-bold text-brandit-orange">{kpiCounts.aprobadas}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-2">Cerradas</p>
          <p className="text-2xl font-bold text-green-600">{kpiCounts.cerradas}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-50 rounded-xl p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors min-h-[40px] ${
              tab === t.key
                ? "bg-white text-brandit-black shadow-sm"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Buscar por cliente o numero..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border-b border-gray-200 py-2 text-sm outline-none focus:border-brandit-orange transition-colors bg-transparent"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-24 text-gray-300">Cargando...</div>
      ) : notas.length === 0 ? (
        <div className="text-center py-24">
          <p className="text-gray-300 text-lg mb-2">
            {search ? "Sin resultados" : "No hay notas de entrega"}
          </p>
          {!search && (
            <Link href="/notas-entrega/nueva" className="text-brandit-orange font-medium hover:underline text-sm">
              Crear la primera nota
            </Link>
          )}
        </div>
      ) : (
        <div>
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-4">
            {notas.length} nota{notas.length !== 1 ? "s" : ""}
          </p>

          {/* Desktop table */}
          <div className="hidden sm:block">
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-6 py-3 text-[10px] uppercase tracking-widest text-gray-400 font-medium">Numero</th>
                    <th className="text-left px-6 py-3 text-[10px] uppercase tracking-widest text-gray-400 font-medium">Fecha</th>
                    <th className="text-left px-6 py-3 text-[10px] uppercase tracking-widest text-gray-400 font-medium">Cliente</th>
                    <th className="text-center px-6 py-3 text-[10px] uppercase tracking-widest text-gray-400 font-medium">Items</th>
                    <th className="text-center px-6 py-3 text-[10px] uppercase tracking-widest text-gray-400 font-medium">Cantidad</th>
                    <th className="text-center px-6 py-3 text-[10px] uppercase tracking-widest text-gray-400 font-medium">Estado</th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {notas.map((n) => (
                    <tr key={n.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="text-xs font-bold text-gray-400 bg-gray-50 rounded-lg px-2.5 py-1">
                          {n.numero}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{formatFecha(n.fecha)}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{n.cliente}</td>
                      <td className="px-6 py-4 text-center text-sm text-gray-500">{n.items_count}</td>
                      <td className="px-6 py-4 text-center text-sm font-medium text-gray-700">{n.total_cantidad}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full capitalize ${estadoBadge(n.estado)}`}>
                          {n.estado}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link href={`/notas-entrega/${n.id}`} className="text-brandit-orange text-sm font-medium hover:underline">
                          Ver
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {notas.map((n) => (
              <Link
                key={n.id}
                href={`/notas-entrega/${n.id}`}
                className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 px-5 py-4 hover:border-brandit-orange/20 hover:shadow-md transition-all"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-gray-400 bg-gray-50 rounded-lg px-2 py-0.5">{n.numero}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${estadoBadge(n.estado)}`}>
                      {n.estado}
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-900 text-sm">{n.cliente}</h3>
                  <p className="text-xs text-gray-400">{formatFecha(n.fecha)} - {n.items_count} items, {n.total_cantidad} uds.</p>
                </div>
                <span className="text-gray-300 text-sm">&#8594;</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
