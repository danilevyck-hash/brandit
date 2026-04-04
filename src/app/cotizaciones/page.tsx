"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Quotation, QUOTATION_STATUSES } from "@/lib/supabase";
import { formatDate } from "@/lib/format";

export default function CotizacionesPage() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const debounceRef = useRef<NodeJS.Timeout>();

  const load = useCallback(async (searchVal: string, statusVal: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusVal) params.set("status", statusVal);
      if (searchVal) params.set("search", searchVal);
      const res = await fetch(`/api/quotations?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setQuotations(Array.isArray(data) ? data : []);
    } catch {
      setQuotations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(search, statusFilter);
  }, [statusFilter, load]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSearch(val: string) {
    setSearch(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      load(val, statusFilter);
    }, 400);
  }

  const statusInfo = (status: string) => QUOTATION_STATUSES.find(s => s.value === status);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-brandit-black tracking-tight">Cotizaciones</h1>
          <p className="text-sm text-gray-400 mt-1">Gestión de costos de producción</p>
        </div>
        <Link
          href="/cotizacion/nueva"
          className="bg-brandit-orange text-white font-semibold px-6 py-3 rounded-xl text-sm hover:bg-brandit-orange/90 transition-colors shadow-sm text-center min-h-[48px] flex items-center justify-center active:scale-[0.98]"
        >
          + Nueva Cotización
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <input
          placeholder="Buscar por cliente..."
          value={search}
          onChange={e => handleSearch(e.target.value)}
          className="flex-1 bg-white border border-gray-100 rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-brandit-orange/20 focus:border-brandit-orange/40 outline-none shadow-sm"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-white border border-gray-100 rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-brandit-orange/20 focus:border-brandit-orange/40 outline-none shadow-sm min-h-[48px]"
        >
          <option value="">Todos los estados</option>
          {QUOTATION_STATUSES.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="w-8 h-8 border-3 border-brandit-orange border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Cargando...</p>
        </div>
      ) : quotations.length === 0 ? (
        <div className="text-center py-24">
          <div className="text-6xl mb-4 opacity-20">📋</div>
          <p className="text-gray-400 text-lg mb-3">No hay cotizaciones</p>
          <Link href="/cotizacion/nueva" className="text-brandit-orange font-medium hover:underline text-sm">Crear la primera cotización</Link>
        </div>
      ) : (
        <div className="space-y-2">
          {quotations.map(q => {
            const si = statusInfo(q.status);
            return (
              <Link
                key={q.id}
                href={`/cotizacion/${q.id}`}
                className="flex items-center justify-between bg-white rounded-2xl border border-gray-50 px-4 sm:px-5 py-4 hover:border-brandit-orange/10 hover:shadow-md transition-all group active:scale-[0.99] min-h-[68px]"
              >
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 font-bold text-xs group-hover:bg-brandit-orange/5 group-hover:text-brandit-black transition-colors flex-shrink-0">
                    #{q.id}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 text-sm group-hover:text-brandit-black transition-colors truncate">
                      {(q.client as { name?: string })?.name || "Sin cliente"}
                    </h3>
                    <p className="text-xs text-gray-400">{formatDate(q.date)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                  <span
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
                    style={{ backgroundColor: si?.color + "15", color: si?.color }}
                  >
                    {si?.label}
                  </span>
                  <span className="text-gray-300 group-hover:text-brandit-black transition-colors text-sm">→</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
