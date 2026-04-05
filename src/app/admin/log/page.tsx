"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type LogEntry = {
  id: string;
  usuario: string;
  accion: string;
  detalle: string | null;
  created_at: string;
};

const ACCION_COLORS: Record<string, { bg: string; text: string }> = {
  LOGIN: { bg: "bg-blue-50", text: "text-blue-600" },
  LEAD_CREATED: { bg: "bg-green-50", text: "text-green-600" },
  LEAD_CONVERTED: { bg: "bg-emerald-50", text: "text-emerald-700" },
  CXC_UPLOAD: { bg: "bg-orange-50", text: "text-orange-600" },
};

export default function LogPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState("");
  const [filterUser, setFilterUser] = useState("");

  useEffect(() => {
    const r = localStorage.getItem("brandit_role") || "";
    setRole(r);
    if (r !== "admin") router.push("/");
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/log");
    const data = await res.json();
    setEntries(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { if (role === "admin") load(); }, [role, load]);

  const usuarios = Array.from(new Set(entries.map((e) => e.usuario))).sort();

  const filtered = filterUser
    ? entries.filter((e) => e.usuario === filterUser)
    : entries;

  const formatDateTime = (d: string) =>
    new Date(d).toLocaleDateString("es-PA", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

  if (role !== "admin") return null;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Administración</p>
          <h1 className="text-3xl font-bold text-brandit-black tracking-tight">Historial de actividad</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/usuarios" className="text-sm text-brandit-orange hover:underline">
            Usuarios
          </Link>
          <select
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-brandit-orange"
          >
            <option value="">Todos los usuarios</option>
            {usuarios.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-24 text-gray-300">Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24 text-gray-300">No hay actividad registrada</div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left">
                <th className="px-6 py-3 text-xs font-semibold text-gray-500">Fecha</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500">Usuario</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500">Acción</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => {
                const ac = ACCION_COLORS[e.accion] || { bg: "bg-gray-50", text: "text-gray-600" };
                return (
                  <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-6 py-3 text-gray-500 text-xs whitespace-nowrap">{formatDateTime(e.created_at)}</td>
                    <td className="px-6 py-3 font-medium text-gray-900">{e.usuario}</td>
                    <td className="px-6 py-3">
                      <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${ac.bg} ${ac.text}`}>
                        {e.accion}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-gray-600">{e.detalle || "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
