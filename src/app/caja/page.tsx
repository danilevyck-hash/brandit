"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type Periodo = {
  id: string;
  numero: number;
  fecha_apertura: string;
  fecha_cierre: string | null;
  fondo_inicial: number;
  estado: string;
  total_gastado: number;
  saldo: number;
};

export default function CajaPage() {
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [loading, setLoading] = useState(true);
  const [fondoInicial, setFondoInicial] = useState("200");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/caja/periodos");
    const data = await res.json();
    setPeriodos(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const crearPeriodo = async () => {
    setCreating(true);
    const res = await fetch("/api/caja/periodos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fondo_inicial: Number(fondoInicial) }),
    });
    const data = await res.json();
    if (data.error) {
      alert(data.error);
    } else {
      load();
    }
    setCreating(false);
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("es-PA", { style: "currency", currency: "USD" }).format(n);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-end justify-between mb-10">
        <div>
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Caja Menuda</h1>
          <p className="text-sm text-gray-400 mt-1">Control de gastos de caja chica</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={fondoInicial}
            onChange={(e) => setFondoInicial(e.target.value)}
            className="w-24 bg-white border border-gray-100 rounded-xl px-3 py-3 text-sm focus:ring-2 focus:ring-navy/10 focus:border-navy/30 outline-none shadow-sm"
            placeholder="Fondo"
          />
          <button
            onClick={crearPeriodo}
            disabled={creating}
            className="bg-navy text-white font-semibold px-6 py-3 rounded-xl text-sm hover:bg-navy/90 transition-colors shadow-sm disabled:opacity-50"
          >
            + Nuevo Período
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-24 text-gray-300 text-lg">Cargando...</div>
      ) : periodos.length === 0 ? (
        <div className="text-center py-24">
          <div className="text-6xl mb-4 opacity-20">💰</div>
          <p className="text-gray-400 text-lg mb-3">No hay períodos de caja</p>
          <p className="text-gray-400 text-sm">Crea el primer período para comenzar</p>
        </div>
      ) : (
        <div className="space-y-2">
          {periodos.map((p) => (
            <Link
              key={p.id}
              href={`/caja/${p.id}`}
              className="flex items-center justify-between bg-white rounded-2xl border border-gray-50 px-5 py-4 hover:border-navy/10 hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 font-bold text-xs group-hover:bg-navy/5 group-hover:text-navy transition-colors">
                  #{p.numero}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm group-hover:text-navy transition-colors">
                    Período {p.numero}
                  </h3>
                  <p className="text-xs text-gray-400">
                    {p.fecha_apertura}{p.fecha_cierre ? ` → ${p.fecha_cierre}` : " → abierto"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs text-gray-400">Saldo</p>
                  <p className={`text-sm font-semibold ${p.saldo < 0 ? "text-red-500" : "text-gray-900"}`}>
                    {fmt(p.saldo)}
                  </p>
                </div>
                <span
                  className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${
                    p.estado === "abierto"
                      ? "bg-green-50 text-green-600"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {p.estado === "abierto" ? "Abierto" : "Cerrado"}
                </span>
                <span className="text-gray-300 group-hover:text-navy transition-colors text-sm">→</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
