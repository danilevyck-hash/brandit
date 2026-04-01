"use client";

import { useState, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

type LeadsPorMes = { mes: string; count: number };
type ConversionVendedora = { vendedora: string; porcentaje: number; total: number };

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
  leadsPorMes: LeadsPorMes[];
  conversionPorVendedora: ConversionVendedora[];
};

type ModuleId = "leads" | "cxc" | "operaciones" | "leadsPorMes" | "conversionPorVendedora";

const DEFAULT_ORDER: ModuleId[] = ["leads", "cxc", "operaciones", "leadsPorMes", "conversionPorVendedora"];
const STORAGE_KEY = "brandit_module_order";

function getStoredOrder(): ModuleId[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ORDER;
    const parsed = JSON.parse(raw) as ModuleId[];
    // Validate all modules present
    if (DEFAULT_ORDER.every((m) => parsed.includes(m)) && parsed.length === DEFAULT_ORDER.length) {
      return parsed;
    }
  } catch { /* ignore */ }
  return DEFAULT_ORDER;
}

function KpiCard({ label, value, sub, danger }: { label: string; value: string; sub?: string; danger?: boolean }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-50 p-5 shadow-sm transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5">
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

const MODULE_ICONS: Record<ModuleId, string> = {
  leads: "👥",
  cxc: "💰",
  operaciones: "📦",
  leadsPorMes: "📊",
  conversionPorVendedora: "📈",
};

const MODULE_LABELS: Record<ModuleId, string> = {
  leads: "Leads",
  cxc: "Cuentas por Cobrar",
  operaciones: "Operaciones",
  leadsPorMes: "Leads por mes",
  conversionPorVendedora: "Conversión por vendedora",
};

function SortableModule({
  id,
  children,
  activeId,
}: {
  id: ModuleId;
  children: React.ReactNode;
  activeId: ModuleId | null;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group ${isDragging ? "opacity-50" : ""} ${activeId && !isDragging ? "border-2 border-dashed border-gray-200 rounded-2xl" : ""}`}
    >
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 right-2 z-10 cursor-grab active:cursor-grabbing p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-gray-100 transition-opacity"
        title="Arrastrar para reordenar"
      >
        <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
          <path d="M7 2a2 2 0 10.001 4.001A2 2 0 007 2zm0 6a2 2 0 10.001 4.001A2 2 0 007 8zm0 6a2 2 0 10.001 4.001A2 2 0 007 14zm6-8a2 2 0 10-.001-4.001A2 2 0 0013 6zm0 2a2 2 0 10.001 4.001A2 2 0 0013 8zm0 6a2 2 0 10.001 4.001A2 2 0 0013 14z" />
        </svg>
      </div>
      {children}
    </div>
  );
}

function DragOverlayContent({ id }: { id: ModuleId }) {
  return (
    <div className="bg-white rounded-2xl border-2 border-brandit-orange shadow-xl p-5 opacity-90">
      <p className="text-sm font-bold text-brandit-black">
        {MODULE_ICONS[id]} {MODULE_LABELS[id]}
      </p>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [nombre, setNombre] = useState("");
  const [moduleOrder, setModuleOrder] = useState<ModuleId[]>(DEFAULT_ORDER);
  const [activeId, setActiveId] = useState<ModuleId | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  useEffect(() => {
    setNombre(localStorage.getItem("brandit_nombre") || "");
    setModuleOrder(getStoredOrder());
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as ModuleId);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setModuleOrder((prev) => {
      const oldIndex = prev.indexOf(active.id as ModuleId);
      const newIndex = prev.indexOf(over.id as ModuleId);
      const next = arrayMove(prev, oldIndex, newIndex);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

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

  const renderModule = (id: ModuleId) => {
    if (!data) return null;

    switch (id) {
      case "leads":
        return (
          <div className="mb-8">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Leads</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard label="Total leads" value={String(data.leads.total)} />
              <KpiCard label="Prospectos activos" value={String(data.leads.prospectos_activos)} />
              <KpiCard label="Convertidos este mes" value={String(data.leads.convertidos_mes)} />
              <KpiCard
                label="Seguimientos vencidos"
                value={String(data.leads.seguimientos_vencidos)}
                danger={data.leads.seguimientos_vencidos > 0}
              />
            </div>
          </div>
        );
      case "cxc":
        return (
          <div className="mb-8">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Cuentas por Cobrar</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard label="Clientes en CxC" value={String(data.cxc.total_clientes)} />
              <KpiCard
                label="Deuda 90+ días"
                value={`$${fmt(data.cxc.deuda_90_plus)}`}
                danger={data.cxc.deuda_90_plus > 0}
              />
              <KpiCard label="Deuda 0-30 días" value={`$${fmt(data.cxc.deuda_0_30)}`} />
              <KpiCard label="Último upload" value={fmtDate(data.cxc.ultimo_upload)} />
            </div>
          </div>
        );
      case "operaciones":
        return (
          <div className="mb-8">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Operaciones</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard label="Guías este mes" value={String(data.operaciones.guias_mes)} />
              <KpiCard label="Gastos caja menuda" value={`$${fmt(data.operaciones.gastos_caja_mes)}`} />
            </div>
          </div>
        );
      case "leadsPorMes":
        return (
          <div className="mb-8">
            <div className="bg-white rounded-2xl border border-gray-50 p-5 shadow-sm">
              <p className="text-sm font-bold text-brandit-black mb-4">Leads por mes</p>
              {data.leadsPorMes.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={data.leadsPorMes}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" name="Leads" fill="#F15A29" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-gray-300 text-sm py-12">Sin datos</p>
              )}
            </div>
          </div>
        );
      case "conversionPorVendedora":
        return (
          <div className="mb-8">
            <div className="bg-white rounded-2xl border border-gray-50 p-5 shadow-sm">
              <p className="text-sm font-bold text-brandit-black mb-4">Conversión por vendedora</p>
              {data.conversionPorVendedora.length > 0 ? (
                <ResponsiveContainer width="100%" height={Math.max(200, data.conversionPorVendedora.length * 50)}>
                  <BarChart data={data.conversionPorVendedora} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
                    <YAxis dataKey="vendedora" type="category" width={120} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value) => [`${value}%`, "Conversión"]} />
                    <Bar dataKey="porcentaje" name="Conversión" radius={[0, 4, 4, 0]}>
                      {data.conversionPorVendedora.map((entry, index) => (
                        <Cell key={index} fill={entry.porcentaje > 50 ? "#22c55e" : "#F15A29"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-gray-300 text-sm py-12">Sin datos</p>
              )}
            </div>
          </div>
        );
    }
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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={moduleOrder} strategy={verticalListSortingStrategy}>
            {moduleOrder.map((id) => (
              <SortableModule key={id} id={id} activeId={activeId}>
                {renderModule(id)}
              </SortableModule>
            ))}
          </SortableContext>
          <DragOverlay>
            {activeId ? <DragOverlayContent id={activeId} /> : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
