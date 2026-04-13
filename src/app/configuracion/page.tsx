"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function ConfiguracionPage() {
  const [role, setRole] = useState("");

  useEffect(() => {
    setRole(localStorage.getItem("brandit_role") || "");
  }, []);

  const isAdmin = role === "admin";

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-4xl font-extrabold text-brandit-black tracking-tight mb-1">Configuración</h1>
      <p className="text-sm text-gray-400 mb-8">Ajustes y herramientas del sistema</p>

      <div className="space-y-3">
        {isAdmin && (
          <Link
            href="/admin/log"
            className="block bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-all"
          >
            <h3 className="font-semibold text-brandit-black text-base mb-1">Registro de actividad</h3>
            <p className="text-xs text-gray-400">Historial de cambios y acciones en el sistema</p>
          </Link>
        )}
        {!isAdmin && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 text-center">
            <p className="text-sm text-gray-400">No hay configuraciones disponibles para tu rol</p>
          </div>
        )}
      </div>
    </div>
  );
}
