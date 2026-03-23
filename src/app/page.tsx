"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Quotation, QUOTATION_STATUSES } from "@/lib/supabase";
import { formatDate } from "@/lib/format";

export default function Dashboard() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (search) params.set("search", search);
    const res = await fetch(`/api/quotations?${params}`);
    const data = await res.json();
    setQuotations(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [statusFilter, search]);

  useEffect(() => { load(); }, [load]);

  const statusInfo = (status: string) => QUOTATION_STATUSES.find(s => s.value === status);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-end justify-between mb-10">
        <div>
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Cotizaciones</h1>
          <p className="text-sm text-gray-400 mt-1">Gestión de costos de producción</p>
        </div>
        <Link
          href="/cotizacion/nueva"
          className="bg-navy text-white font-semibold px-6 py-3 rounded-xl text-sm hover:bg-navy/90 transition-colors shadow-sm"
        >
          + Nueva Cotización
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <input
          placeholder="Buscar por cliente..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-navy/10 focus:border-navy/30 outline-none shadow-sm"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-navy/10 focus:border-navy/30 outline-none shadow-sm"
        >
          <option value="">Todos los estados</option>
          {QUOTATION_STATUSES.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-24 text-gray-300 text-lg">Cargando...</div>
      ) : quotations.length === 0 ? (
        <div className="text-center py-24">
          <div className="text-6xl mb-4 opacity-20">📋</div>
          <p className="text-gray-400 text-lg mb-3">No hay cotizaciones</p>
          <Link href="/cotizacion/nueva" className="text-navy font-medium hover:underline text-sm">Crear la primera cotización</Link>
        </div>
      ) : (
        <div className="space-y-2">
          {quotations.map(q => {
            const si = statusInfo(q.status);
            return (
              <Link
                key={q.id}
                href={`/cotizacion/${q.id}`}
                className="flex items-center justify-between bg-white rounded-2xl border border-gray-50 px-5 py-4 hover:border-navy/10 hover:shadow-md transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 font-bold text-xs group-hover:bg-navy/5 group-hover:text-navy transition-colors">
                    #{q.id}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm group-hover:text-navy transition-colors">
                      {(q.client as { name?: string })?.name || "Sin cliente"}
                    </h3>
                    <p className="text-xs text-gray-400">{formatDate(q.date)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className="text-[10px] font-semibold px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: si?.color + "15", color: si?.color }}
                  >
                    {si?.label}
                  </span>
                  <span className="text-gray-300 group-hover:text-navy transition-colors text-sm">→</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
