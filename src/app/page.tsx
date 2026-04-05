"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
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
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Avatar from "@/components/Avatar";

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

type ModuleId = "cxc" | "guias" | "caja" | "leads" | "cotizaciones" | "usuarios";

type ModuleConfig = {
  id: ModuleId;
  icon: string;
  label: string;
  description: string;
  href: string;
  color: string;
  bgColor: string;
  adminOnly?: boolean;
};

const MODULES: ModuleConfig[] = [
  { id: "cxc", icon: "\uD83D\uDCCA", label: "CxC", description: "Ver saldos y cobros pendientes", href: "/cxc", color: "text-blue-600", bgColor: "bg-blue-50" },
  { id: "guias", icon: "\uD83D\uDE9A", label: "Gu\u00edas", description: "Registrar env\u00edos y entregas", href: "/guias", color: "text-emerald-600", bgColor: "bg-emerald-50" },
  { id: "caja", icon: "\uD83D\uDCB5", label: "Caja Menuda", description: "Registrar gastos de caja chica", href: "/caja", color: "text-amber-600", bgColor: "bg-amber-50" },
  { id: "leads", icon: "\uD83E\uDD1D", label: "Leads", description: "Seguimiento de clientes nuevos", href: "/leads", color: "text-purple-600", bgColor: "bg-purple-50" },
  { id: "cotizaciones", icon: "\uD83D\uDCCB", label: "Cotizaciones", description: "Crear y ver presupuestos", href: "/cotizaciones", color: "text-rose-600", bgColor: "bg-rose-50" },
  { id: "usuarios", icon: "\uD83D\uDC65", label: "Usuarios", description: "Administrar personas y accesos", href: "/admin/usuarios", color: "text-gray-600", bgColor: "bg-gray-100", adminOnly: true },
];

const DEFAULT_ORDER: ModuleId[] = ["cxc", "guias", "caja", "leads", "cotizaciones", "usuarios"];
const STORAGE_KEY = "brandit_home_module_order";

function getStoredOrder(): ModuleId[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ORDER;
    const parsed = JSON.parse(raw) as ModuleId[];
    if (DEFAULT_ORDER.every((m) => parsed.includes(m)) && parsed.length === DEFAULT_ORDER.length) {
      return parsed;
    }
  } catch { /* ignore */ }
  return DEFAULT_ORDER;
}

function SortableCard({
  mod,
  activeId,
}: {
  mod: ModuleConfig;
  activeId: ModuleId | null;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: mod.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "opacity-40 z-10" : ""}>
      <Link
        href={mod.href}
        className={`group relative block bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 shadow-sm
          transition-all duration-200 hover:shadow-xl hover:-translate-y-1 hover:border-gray-200
          ${activeId && !isDragging ? "border-dashed border-gray-300" : ""}`}
      >
        {/* Drag handle */}
        <div
          {...attributes}
          {...listeners}
          onClick={(e) => e.preventDefault()}
          className="absolute top-3 right-3 z-10 cursor-grab active:cursor-grabbing p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-opacity"
          title="Arrastrar para reordenar"
        >
          <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 2a2 2 0 10.001 4.001A2 2 0 007 2zm0 6a2 2 0 10.001 4.001A2 2 0 007 8zm0 6a2 2 0 10.001 4.001A2 2 0 007 14zm6-8a2 2 0 10-.001-4.001A2 2 0 0013 6zm0 2a2 2 0 10.001 4.001A2 2 0 0013 8zm0 6a2 2 0 10.001 4.001A2 2 0 0013 14z" />
          </svg>
        </div>

        {/* Icon */}
        <div className={`w-14 h-14 ${mod.bgColor} rounded-2xl flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform`}>
          {mod.icon}
        </div>

        {/* Text */}
        <h3 className="text-lg font-bold text-brandit-black dark:text-white tracking-tight">{mod.label}</h3>
        <p className="text-sm text-gray-400 mt-1">{mod.description}</p>
      </Link>
    </div>
  );
}

function DragOverlayCard({ mod }: { mod: ModuleConfig }) {
  return (
    <div className="bg-white rounded-2xl border-2 border-brandit-orange shadow-2xl p-6 opacity-95 w-full">
      <div className={`w-14 h-14 ${mod.bgColor} rounded-2xl flex items-center justify-center text-2xl mb-4`}>
        {mod.icon}
      </div>
      <h3 className="text-lg font-bold text-brandit-black">{mod.label}</h3>
      <p className="text-sm text-gray-400 mt-1">{mod.description}</p>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [nombre, setNombre] = useState("");
  const [role, setRole] = useState("");
  const [dark, setDark] = useState(false);
  const [moduleOrder, setModuleOrder] = useState<ModuleId[]>(DEFAULT_ORDER);
  const [activeId, setActiveId] = useState<ModuleId | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  useEffect(() => {
    setNombre(localStorage.getItem("brandit_nombre") || "");
    setRole(localStorage.getItem("brandit_role") || "");
    setModuleOrder(getStoredOrder());
    setDark(document.documentElement.classList.contains("dark"));
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

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("brandit_dark_mode", "1");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.removeItem("brandit_dark_mode");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("brandit_role");
    localStorage.removeItem("brandit_email");
    localStorage.removeItem("brandit_nombre");
    localStorage.removeItem("brandit_empresa");
    document.cookie = "brandit_session=; path=/; max-age=0";
    window.location.href = "/login";
  };

  const now = new Date();
  const greeting = now.getHours() < 12 ? "Buenos d\u00edas" : now.getHours() < 18 ? "Buenas tardes" : "Buenas noches";
  const dateStr = now.toLocaleDateString("es-PA", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const fmt = (n: number) =>
    new Intl.NumberFormat("es-PA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

  const isAdmin = role === "admin";

  // Filter modules by role
  const visibleModules = MODULES.filter((m) => !m.adminOnly || isAdmin);
  const orderedModules = moduleOrder
    .map((id) => visibleModules.find((m) => m.id === id))
    .filter((m): m is ModuleConfig => !!m);

  const activeModule = activeId ? MODULES.find((m) => m.id === activeId) : null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header — replaces navbar on home */}
      <div className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-4">
          <img src="/brandit-logo.svg" alt="Brand It" className="h-10 w-10 object-contain rounded" />
          <div>
            <h1 className="text-2xl font-extrabold text-brandit-black dark:text-white tracking-tight">
              {greeting}, {nombre || "usuario"}
            </h1>
            <p className="text-sm text-gray-400 mt-0.5 capitalize">{dateStr}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleDark}
            className="p-2 rounded-xl text-gray-400 hover:text-brandit-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Toggle dark mode"
          >
            {dark ? "\u2600\uFE0F" : "\uD83C\uDF19"}
          </button>
          {nombre && <Avatar nombre={nombre} size="sm" />}
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-brandit-orange transition-colors"
          >
            Salir
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm">
          <p className="text-xs font-medium text-gray-400 mb-1">Leads activos</p>
          <p className="text-3xl font-extrabold tracking-tight text-brandit-black dark:text-white">
            {data ? String(data.leads.total) : "-"}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm">
          <p className="text-xs font-medium text-gray-400 mb-1">Deuda vencida (90+ d\u00edas)</p>
          <p className={`text-3xl font-extrabold tracking-tight ${data && data.cxc.deuda_90_plus > 0 ? "text-red-600" : "text-brandit-black dark:text-white"}`}>
            {data ? `$${fmt(data.cxc.deuda_90_plus)}` : "-"}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm">
          <p className="text-xs font-medium text-gray-400 mb-1">Seguimientos vencidos</p>
          <p className={`text-3xl font-extrabold tracking-tight ${data && data.leads.seguimientos_vencidos > 0 ? "text-red-600" : "text-brandit-black dark:text-white"}`}>
            {data ? String(data.leads.seguimientos_vencidos) : "-"}
          </p>
        </div>
      </div>

      {/* Module cards grid */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={orderedModules.map((m) => m.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {orderedModules.map((mod) => (
              <SortableCard key={mod.id} mod={mod} activeId={activeId} />
            ))}
          </div>
        </SortableContext>
        <DragOverlay>
          {activeModule ? <DragOverlayCard mod={activeModule} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
