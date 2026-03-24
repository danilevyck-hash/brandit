"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type Guia = {
  id: string;
  numero: number;
  fecha: string;
  transportista: string;
  placa: string;
  total_bultos: number;
  total_items: number;
};

export default function GuiasPage() {
  const [guias, setGuias] = useState<Guia[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/guias");
    const data = await res.json();
    setGuias(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-end justify-between mb-10">
        <div>
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Guías de Transporte</h1>
          <p className="text-sm text-gray-400 mt-1">Control de envíos y entregas</p>
        </div>
        <Link href="/guias/nueva" className="bg-navy text-white font-semibold px-6 py-3 rounded-xl text-sm hover:bg-navy/90 transition-colors shadow-sm">
          + Nueva Guía
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-24 text-gray-300 text-lg">Cargando...</div>
      ) : guias.length === 0 ? (
        <div className="text-center py-24">
          <div className="text-6xl mb-4 opacity-20">🚚</div>
          <p className="text-gray-400 text-lg mb-3">No hay guías de transporte</p>
          <Link href="/guias/nueva" className="text-navy font-medium hover:underline text-sm">Crear la primera guía</Link>
        </div>
      ) : (
        <div className="space-y-2">
          {guias.map((g) => (
            <Link
              key={g.id}
              href={`/guias/${g.id}`}
              className="flex items-center justify-between bg-white rounded-2xl border border-gray-50 px-5 py-4 hover:border-navy/10 hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 font-bold text-xs group-hover:bg-navy/5 group-hover:text-navy transition-colors">
                  #{g.numero}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm group-hover:text-navy transition-colors">
                    {g.transportista}
                  </h3>
                  <p className="text-xs text-gray-400">{g.fecha} · Placa: {g.placa}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs text-gray-400">{g.total_items} items · {g.total_bultos} bultos</p>
                </div>
                <span className="text-gray-300 group-hover:text-navy transition-colors text-sm">→</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
