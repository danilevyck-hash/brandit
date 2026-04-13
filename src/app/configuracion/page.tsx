"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function ConfiguracionPage() {
  const [role, setRole] = useState("");
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setRole(localStorage.getItem("brandit_role") || "");
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

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

  const isAdmin = role === "admin";

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-4xl font-extrabold text-brandit-black tracking-tight mb-1">Configuración</h1>
      <p className="text-sm text-gray-400 mb-8">Ajustes y herramientas del sistema</p>

      <div className="space-y-3">
        {/* Dark mode toggle */}
        <button
          onClick={toggleDark}
          className="w-full bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-all flex items-center justify-between text-left"
        >
          <div>
            <h3 className="font-semibold text-brandit-black text-base mb-1">
              {dark ? "☀️ Modo claro" : "🌙 Modo oscuro"}
            </h3>
            <p className="text-xs text-gray-400">Cambiar apariencia de la aplicación</p>
          </div>
          <div className={`w-11 h-6 rounded-full transition-colors relative ${dark ? "bg-brandit-orange" : "bg-gray-200"}`}>
            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${dark ? "translate-x-5" : "translate-x-0.5"}`} />
          </div>
        </button>

        {/* Activity log (admin only) */}
        {isAdmin && (
          <Link
            href="/admin/log"
            className="block bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-all"
          >
            <h3 className="font-semibold text-brandit-black text-base mb-1">Registro de actividad</h3>
            <p className="text-xs text-gray-400">Historial de cambios y acciones en el sistema</p>
          </Link>
        )}
      </div>
    </div>
  );
}
