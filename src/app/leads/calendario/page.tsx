"use client";

import { Suspense, useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

// Requiere en Vercel: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXT_PUBLIC_GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

function formatDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export default function CalendarioPageWrapper() {
  return (
    <Suspense fallback={<div className="text-center py-24 text-gray-300">Cargando...</div>}>
      <CalendarioPage />
    </Suspense>
  );
}

function CalendarioPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState("");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [syncingLeadId, setSyncingLeadId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const todayStr = new Date().toISOString().split("T")[0];

  useEffect(() => {
    const r = localStorage.getItem("brandit_role") || "";
    setRole(r);
    if (r !== "admin" && r !== "secretaria") {
      router.replace("/leads");
    }
    // Check if Google is connected
    const token = localStorage.getItem("google_access_token");
    setGoogleConnected(!!token);
  }, [router]);

  // Show toast if just connected
  useEffect(() => {
    if (searchParams.get("google") === "connected") {
      setGoogleConnected(true);
      showToast("Google Calendar conectado");
    }
  }, [searchParams]);

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

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const connectGoogle = () => {
    if (!GOOGLE_CLIENT_ID) {
      showToast("Google Calendar no está configurado aún");
      return;
    }
    const redirectUri = `${window.location.origin}/api/google/callback`;
    const scope = "https://www.googleapis.com/auth/calendar.events";
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`;
    window.location.href = url;
  };

  const syncToGoogle = async (lead: Lead) => {
    const token = localStorage.getItem("google_access_token");
    if (!token) {
      showToast("Conecta Google Calendar primero");
      return;
    }
    setSyncingLeadId(lead.id);

    try {
      const res = await fetch("/api/google/sync-calendar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-google-token": token,
        },
        body: JSON.stringify({
          leadId: lead.id,
          nombre: lead.nombre,
          fecha: lead.fecha_seguimiento,
          nota: lead.empresa ? `Empresa: ${lead.empresa}` : undefined,
        }),
      });

      const data = await res.json();

      if (data.error) {
        if (res.status === 401) {
          localStorage.removeItem("google_access_token");
          setGoogleConnected(false);
          showToast("Sesión expirada. Reconecta Google Calendar.");
        } else {
          showToast(`Error: ${data.error}`);
        }
      } else {
        showToast("Evento agregado a Google Calendar");
      }
    } catch {
      showToast("Error de conexión");
    }
    setSyncingLeadId(null);
  };

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
          <button
            onClick={googleConnected ? () => { localStorage.removeItem("google_access_token"); setGoogleConnected(false); showToast("Google Calendar desconectado"); } : connectGoogle}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              googleConnected
                ? "bg-green-50 text-green-700 hover:bg-green-100"
                : "bg-white border border-gray-200 text-gray-700 hover:border-gray-300 hover:shadow-sm"
            }`}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {googleConnected ? "Google Calendar conectado" : "Conectar Google Calendar"}
          </button>
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
                        <div
                          key={lead.id}
                          className="bg-white rounded-xl px-3.5 py-3 border border-gray-100 hover:shadow-md transition-all"
                        >
                          <Link href="/leads">
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
                          {/* Google Calendar sync button */}
                          {googleConnected && (
                            <button
                              onClick={() => syncToGoogle(lead)}
                              disabled={syncingLeadId === lead.id}
                              className="mt-2 w-full flex items-center justify-center gap-1.5 text-[11px] font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
                            >
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                              </svg>
                              {syncingLeadId === lead.id ? "Sincronizando..." : "Sync con Google"}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-brandit-black text-white px-6 py-3 rounded-xl text-sm font-medium shadow-lg animate-fade-in">
          {toast}
        </div>
      )}
    </div>
  );
}
