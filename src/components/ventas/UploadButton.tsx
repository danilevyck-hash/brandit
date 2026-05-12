"use client";

import { useState } from "react";

export type UploadStats = {
  cotizaciones: number;
  pedidos: number;
  facturas: number;
  notasCredito: number;
  notasDebito: number;
  tiquetes: number;
  transacciones: number;
  invalidTipo: number;
  invalidFecha: number;
  invalidCliente: number;
};

export type UploadResponse = {
  ok?: boolean;
  inserted?: number;
  stats?: UploadStats;
  filename?: string;
  clientes_sincronizados?: number;
  error?: string;
};

type Props = {
  onResult?: (r: UploadResponse) => void;
};

export default function UploadButton({ onResult }: Props) {
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/ventas/upload", { method: "POST", body: formData });
      const data: UploadResponse = await res.json();

      if (!res.ok || data.error) {
        alert(data.error || `Error del servidor: ${res.status}`);
        return;
      }
      onResult?.(data);
    } catch (err) {
      alert(`Error al subir el archivo: ${err instanceof Error ? err.message : "desconocido"}`);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <label
      className={`bg-brandit-orange text-white font-semibold px-6 py-3 rounded-xl text-sm hover:bg-brandit-orange/90 transition-colors shadow-sm cursor-pointer ${uploading ? "opacity-50 pointer-events-none" : ""}`}
    >
      {uploading ? "Cargando..." : "Cargar Ventas CSV"}
      <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
    </label>
  );
}
