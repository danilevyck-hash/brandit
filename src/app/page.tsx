"use client";

import { useState, useEffect } from "react";

type DashboardData = {
  leads: {
    total: number;
    prospectos_activos: number;
    convertidos_mes: number;
    seguimientos_vencidos: number;
  };
  cxc: {
    total_clientes: number;
    deuda_90_plus: number;
    deuda_0_30: number;
    ultimo_upload: string | null;
  };
  operaciones: {
    guias_mes: number;
    gastos_caja_mes: number;
  };
};

function KpiCard({ label, value, sub, danger }: { label: string; value: string; sub?: string; danger?: boolean }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-50 p-5 shadow-sm">
      <p className="text-xs font-medium text-gray-400 mb-1">{label}</p>
      <p className={`text-3xl font-extrabold tracking-tight ${danger ? "text-red-600" : "text-brandit-black"}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-50 p-5 shadow-sm animate-pulse">
      <div className="h-3 w-24 bg-gray-100 rounded mb-3" />
      <div className="h-8 w-20 bg-gray-100 rounded" />
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [nombre, setNombre] = useState("");

  useEffect(() => {
    setNombre(localStorage.getItem("brandit_nombre") || "");
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  const now = new Date();
  const greeting = now.getHours() < 12 ? "Buenos días" : now.getHours() < 18 ? "Buenas tardes" : "Buenas noches";
  const dateStr = now.toLocaleDateString("es-PA", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const fmt = (n: number) =>
    new Intl.NumberFormat("es-PA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

  const fmtDate = (iso: string | null) => {
    if (!iso) return "-";
    const d = new Date(iso);
    return d.toLocaleDateString("es-PA", { day: "2-digit", month: "short", year: "numeric" });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-extrabold text-brandit-black tracking-tight">
          {greeting}, {nombre || "usuario"}
        </h1>
        <p className="text-sm text-gray-400 mt-1 capitalize">{dateStr}</p>
      </div>

      {!data ? (
        <>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Leads</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Cuentas por Cobrar</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Operaciones</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 2 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        </>
      ) : (
        <>
          {/* Row 1 — Leads */}
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Leads</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <KpiCard label="Total leads" value={String(data.leads.total)} />
            <KpiCard label="Prospectos activos" value={String(data.leads.prospectos_activos)} />
            <KpiCard label="Convertidos este mes" value={String(data.leads.convertidos_mes)} />
            <KpiCard
              label="Seguimientos vencidos"
              value={String(data.leads.seguimientos_vencidos)}
              danger={data.leads.seguimientos_vencidos > 0}
            />
          </div>

          {/* Row 2 — CxC */}
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Cuentas por Cobrar</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <KpiCard label="Clientes en CxC" value={String(data.cxc.total_clientes)} />
            <KpiCard
              label="Deuda 90+ días"
              value={`$${fmt(data.cxc.deuda_90_plus)}`}
              danger={data.cxc.deuda_90_plus > 0}
            />
            <KpiCard label="Deuda 0-30 días" value={`$${fmt(data.cxc.deuda_0_30)}`} />
            <KpiCard label="Último upload" value={fmtDate(data.cxc.ultimo_upload)} />
          </div>

          {/* Row 3 — Operaciones */}
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Operaciones</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Guías este mes" value={String(data.operaciones.guias_mes)} />
            <KpiCard label="Gastos caja menuda" value={`$${fmt(data.operaciones.gastos_caja_mes)}`} />
          </div>
        </>
      )}
    </div>
  );
}
