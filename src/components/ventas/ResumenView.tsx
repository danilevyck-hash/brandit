"use client";

import { useEffect } from "react";
import type { VentasResumen } from "./types";

type Props = { data: VentasResumen };

export default function ResumenView({ data }: Props) {
  // Console temporal — limpiar en commit siguiente (Fase 3.2 KPIs).
  useEffect(() => {
    console.log("[ResumenView] data:", data);
  }, [data]);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 px-6 py-12 text-center">
      <p className="text-gray-400 text-lg">Fase 3.2 — KPIs próximamente</p>
      <p className="text-gray-300 text-sm mt-2">
        Año {data.year} · mes actual {data.mesActual || "—"}
      </p>
    </div>
  );
}
