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
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/guias");
    const data = await res.json();
    setGuias(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = guias.filter((g) =>
    !search ||
    g.transportista.toLowerCase().includes(search.toLowerCase()) ||
    String(g.numero).includes(search)
  );

  const totalBultosMonth = guias.reduce((s, g) => {
    const d = new Date(g.fecha);
    const now = new Date();
    if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) return s + g.total_bultos;
    return s;
  }, 0);

  const guiasThisMonth = guias.filter((g) => {
    const d = new Date(g.fecha);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Log\u00edstica</p>
          <h1 className="text-3xl font-bold text-brandit-black tracking-tight">Gu\u00edas de transporte</h1>
          <p className="text-sm text-gray-400 mt-1">Registro de env\u00edos y entregas</p>
        </div>
        <Link
          href="/guias/nueva"
          className="bg-brandit-orange text-white rounded-xl px-6 py-2.5 text-sm font-medium hover:bg-brandit-orange/90 transition-colors"
        >
          + Nueva Guía
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-2">Total gu\u00edas</p>
          <p className="text-3xl font-bold text-brandit-black">{guias.length}</p>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-2">Este mes</p>
          <p className="text-3xl font-bold text-brandit-black">{guiasThisMonth}</p>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-2">Bultos este mes</p>
          <p className="text-3xl font-bold text-brandit-black">{totalBultosMonth}</p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Buscar por transportista o número..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border-b border-gray-200 py-2 text-sm outline-none focus:border-brandit-orange transition-colors bg-transparent"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-24 text-gray-300">Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24">
          <p className="text-gray-300 text-lg mb-2">
            {search ? "No se encontraron gu\u00edas" : "Todav\u00eda no hay gu\u00edas registradas"}
          </p>
          {!search && (
            <Link href="/guias/nueva" className="text-brandit-orange font-medium hover:underline text-sm">
              Crear la primera gu\u00eda
            </Link>
          )}
        </div>
      ) : (
        <div>
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-4">
            {filtered.length} guía{filtered.length !== 1 ? "s" : ""}
          </p>
          <div className="space-y-3">
            {filtered.map((g) => (
              <Link
                key={g.id}
                href={`/guias/${g.id}`}
                className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 px-6 py-5 hover:border-brandit-orange/20 hover:shadow-md transition-all group"
              >
                <div className="flex items-center gap-4">
                  <span className="text-xs font-bold text-gray-400 bg-gray-50 rounded-lg px-2.5 py-1 group-hover:bg-brandit-orange/5 group-hover:text-brandit-black transition-colors">
                    #{g.numero}
                  </span>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm group-hover:text-brandit-black transition-colors">
                      {g.transportista}
                    </h3>
                    <p className="text-xs text-gray-400">{g.fecha} · Placa: {g.placa}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-brandit-orange/10 text-brandit-black">
                      {g.total_items} items
                    </span>
                    <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
                      {g.total_bultos} bultos
                    </span>
                  </div>
                  <span className="text-gray-300 group-hover:text-brandit-black transition-colors text-sm">→</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
