"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Lead = {
  id: string;
  nombre: string;
  empresa: string;
  telefono: string;
  vendedora: string;
  estado: string;
  estado_venta: string;
  fecha_seguimiento: string | null;
};

const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  // Convert Sunday=0 to Monday-based (Mon=0, Sun=6)
  return day === 0 ? 6 : day - 1;
}

function formatDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export default function CalendarioPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState("");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const todayStr = new Date().toISOString().split("T")[0];

  useEffect(() => {
    const r = localStorage.getItem("brandit_role") || "";
    setRole(r);
    if (r !== "admin" && r !== "secretaria") {
      router.replace("/leads");
    }
  }, [router]);

  useEffect(() => {
    if (!role) return;
    setLoading(true);
    fetch("/api/leads")
      .then((r) => r.json())
      .then((data) => {
        setLeads(Array.isArray(data) ? data.filter((l: Lead) => l.fecha_seguimiento) : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [role]);

  // Group leads by fecha_seguimiento
  const leadsByDate = useMemo(() => {
    const map: Record<string, Lead[]> = {};
    for (const lead of leads) {
      if (lead.fecha_seguimiento) {
        const key = lead.fecha_seguimiento.split("T")[0];
        if (!map[key]) map[key] = [];
        map[key].push(lead);
      }
    }
    return map;
  }, [leads]);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const selectedLeads = selectedDay ? (leadsByDate[selectedDay] || []) : [];

  if (role !== "admin" && role !== "secretaria") return null;

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold text-brandit-black tracking-tight">Calendario de Seguimientos</h1>
            <div className="flex items-center gap-3 mt-1">
              <Link href="/leads" className="text-xs text-brandit-orange hover:underline">Leads</Link>
              <Link href="/leads/reporte" className="text-xs text-brandit-orange hover:underline">Reporte</Link>
            </div>
          </div>
        </div>

        {/* Month navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={prevMonth}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
            aria-label="Mes anterior"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-lg font-bold text-brandit-black">
            {MESES[month]} {year}
          </h2>
          <button
            onClick={nextMonth}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
            aria-label="Mes siguiente"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="text-center py-24 text-gray-300">Cargando...</div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Calendar grid */}
            <div className="flex-1">
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 mb-1">
                {DIAS_SEMANA.map((d) => (
                  <div key={d} className="text-center text-[10px] font-semibold text-gray-400 uppercase py-2">
                    {d}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 gap-1">
                {/* Empty cells before first day */}
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div key={`empty-${i}`} className="aspect-square" />
                ))}
                {/* Day cells */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const dateKey = formatDateKey(year, month, day);
                  const dayLeads = leadsByDate[dateKey] || [];
                  const count = dayLeads.length;
                  const isToday = dateKey === todayStr;
                  const isPast = dateKey < todayStr;
                  const isFuture = dateKey > todayStr;
                  const isSelected = dateKey === selectedDay;

                  let bgClass = "";
                  if (count > 0 && isPast) bgClass = "bg-red-50";
                  else if (count > 0 && isFuture) bgClass = "bg-orange-50";

                  return (
                    <button
                      key={day}
                      onClick={() => setSelectedDay(dateKey === selectedDay ? null : dateKey)}
                      className={`aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all
                        ${bgClass}
                        ${isToday ? "ring-2 ring-brandit-orange" : ""}
                        ${isSelected ? "bg-brandit-orange/10 ring-2 ring-brandit-orange" : ""}
                        ${count > 0 ? "cursor-pointer hover:shadow-md" : "cursor-default"}
                      `}
                    >
                      <span className={`text-sm font-medium ${isToday ? "text-brandit-orange font-bold" : "text-gray-700"}`}>
                        {day}
                      </span>
                      {count > 0 && (
                        <div className="flex gap-0.5 mt-0.5">
                          {count <= 3 ? (
                            Array.from({ length: count }).map((_, j) => (
                              <div
                                key={j}
                                className={`w-1.5 h-1.5 rounded-full ${isPast ? "bg-red-400" : "bg-brandit-orange"}`}
                              />
                            ))
                          ) : (
                            <span className={`text-[9px] font-bold ${isPast ? "text-red-500" : "text-brandit-orange"}`}>
                              {count}
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Side panel — selected day leads */}
            {selectedDay && (
              <div className="lg:w-80 flex-shrink-0">
                <div className="bg-gray-50 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-brandit-black">
                      {new Date(selectedDay + "T12:00:00").toLocaleDateString("es-PA", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })}
                    </h3>
                    <button
                      onClick={() => setSelectedDay(null)}
                      className="text-gray-400 hover:text-gray-600 text-lg"
                    >
                      &times;
                    </button>
                  </div>
                  {selectedLeads.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">Sin seguimientos este día</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedLeads.map((lead) => (
                        <Link
                          key={lead.id}
                          href="/leads"
                          className="block bg-white rounded-xl px-3.5 py-3 border border-gray-100 hover:shadow-md transition-all"
                        >
                          <h4 className="font-semibold text-sm text-gray-900 truncate">{lead.nombre}</h4>
                          {lead.empresa && (
                            <p className="text-xs text-gray-400 mt-0.5 truncate">{lead.empresa}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1.5">
                            {lead.vendedora && (
                              <span className="text-[10px] text-gray-400">{lead.vendedora}</span>
                            )}
                            {lead.telefono && (
                              <span className="text-xs text-brandit-orange">{lead.telefono}</span>
                            )}
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
