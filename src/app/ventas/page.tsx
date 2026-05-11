"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type UploadStats = {
  cotizaciones: number;
  pedidos: number;
  passthrough: number;
  invalidTipo: number;
  invalidFecha: number;
  invalidCliente: number;
};

type UploadResponse = {
  ok?: boolean;
  inserted?: number;
  stats?: UploadStats;
  filename?: string;
  clientes_creados?: number;
  clientes_actualizados?: number;
  error?: string;
};

export default function VentasPage() {
  const router = useRouter();
  const [role, setRole] = useState("");
  const [uploading, setUploading] = useState(false);
  const [lastResult, setLastResult] = useState<UploadResponse | null>(null);

  useEffect(() => {
    const r = localStorage.getItem("brandit_role") || "";
    setRole(r);
    if (r && r !== "admin") router.replace("/");
  }, [router]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setLastResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/ventas/upload", { method: "POST", body: formData });
      const data: UploadResponse = await res.json();

      if (!res.ok || data.error) {
        alert(data.error || `Error del servidor: ${res.status}`);
        return;
      }
      setLastResult(data);
    } catch (err) {
      alert(`Error al subir el archivo: ${err instanceof Error ? err.message : "desconocido"}`);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  if (role && role !== "admin") return null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-4xl font-extrabold text-brandit-black tracking-tight">Ventas</h1>
          <p className="text-sm text-gray-400 mt-1">Cotizaciones, pedidos y facturas de Confecciones Boston</p>
        </div>
        <label
          className={`bg-brandit-orange text-white font-semibold px-6 py-3 rounded-xl text-sm hover:bg-brandit-orange/90 transition-colors shadow-sm cursor-pointer ${uploading ? "opacity-50 pointer-events-none" : ""}`}
        >
          {uploading ? "Cargando..." : "Cargar Ventas CSV"}
          <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
        </label>
      </div>

      {lastResult?.ok && (
        <div className="mb-6 bg-green-50 border border-green-100 rounded-xl px-5 py-4 text-sm">
          <p className="font-semibold text-green-700 mb-1">Carga completada</p>
          <p className="text-green-600">
            {lastResult.stats?.cotizaciones ?? 0} cotizaciones · {lastResult.stats?.pedidos ?? 0} pedidos
          </p>
          <p className="text-green-600 mt-0.5">
            {lastResult.clientes_creados ?? 0} clientes nuevos · {lastResult.clientes_actualizados ?? 0} actualizados
          </p>
          {(lastResult.stats?.passthrough ?? 0) > 0 && (
            <p className="text-xs text-green-500 mt-1">
              {lastResult.stats?.passthrough} facturas/notas/tiquetes (manejado por fashiongr).
            </p>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 px-6 py-12 text-center">
        <p className="text-gray-400 text-lg">Tabs Resumen y Clientes próximamente</p>
        <p className="text-gray-300 text-sm mt-2">Por ahora solo upload del CSV de Switch.</p>
      </div>
    </div>
  );
}
