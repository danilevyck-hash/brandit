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

type Categoria = { id: string; nombre: string };
type Responsable = { id: string; nombre: string };

export default function CajaPage() {
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [loading, setLoading] = useState(true);
  const [fondoInicial, setFondoInicial] = useState("200");
  const [creating, setCreating] = useState(false);
  const [role, setRole] = useState("");
  const [showCatModal, setShowCatModal] = useState(false);
  const [showRespModal, setShowRespModal] = useState(false);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [responsables, setResponsables] = useState<Responsable[]>([]);
  const [newCat, setNewCat] = useState("");
  const [newResp, setNewResp] = useState("");

  useEffect(() => { setRole(localStorage.getItem("brandit_role") || ""); }, []);

  const isAdmin = role === "admin";

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/caja/periodos");
    const data = await res.json();
    setPeriodos(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadCategorias = async () => {
    const res = await fetch("/api/caja/categorias");
    setCategorias(await res.json());
  };

  const loadResponsables = async () => {
    const res = await fetch("/api/caja/responsables");
    setResponsables(await res.json());
  };

  const crearPeriodo = async () => {
    setCreating(true);
    const res = await fetch("/api/caja/periodos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fondo_inicial: Number(fondoInicial) }),
    });
    const data = await res.json();
    if (data.error) alert(data.error);
    else load();
    setCreating(false);
  };

  const addCategoria = async () => {
    if (!newCat.trim()) return;
    await fetch("/api/caja/categorias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: newCat.trim() }),
    });
    setNewCat("");
    loadCategorias();
  };

  const deleteCategoria = async (id: string) => {
    await fetch(`/api/caja/categorias/${id}`, { method: "PATCH" });
    loadCategorias();
  };

  const addResponsable = async () => {
    if (!newResp.trim()) return;
    await fetch("/api/caja/responsables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: newResp.trim() }),
    });
    setNewResp("");
    loadResponsables();
  };

  const deleteResponsable = async (id: string) => {
    await fetch(`/api/caja/responsables/${id}`, { method: "PATCH" });
    loadResponsables();
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("es-PA", { style: "currency", currency: "USD" }).format(n);

  const periodoActivo = periodos.find((p) => p.estado === "abierto");
  const hasOpen = !!periodoActivo;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Finanzas</p>
          <h1 className="text-3xl font-bold text-brandit-black tracking-tight">Caja Menuda</h1>
          <p className="text-sm text-gray-400 mt-1">Control de gastos de caja chica</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowCatModal(true); loadCategorias(); }}
              className="border border-gray-200 text-gray-600 rounded-xl px-4 py-2.5 text-sm hover:border-gray-300 transition-colors"
            >
              Categorías
            </button>
            <button
              onClick={() => { setShowRespModal(true); loadResponsables(); }}
              className="border border-gray-200 text-gray-600 rounded-xl px-4 py-2.5 text-sm hover:border-gray-300 transition-colors"
            >
              Responsables
            </button>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-2">Total Períodos</p>
          <p className="text-3xl font-bold text-brandit-black">{periodos.length}</p>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-2">Período Activo</p>
          <p className="text-3xl font-bold text-brandit-black">
            {periodoActivo ? `#${periodoActivo.numero}` : "—"}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-2">Gastado (Activo)</p>
          <p className="text-3xl font-bold text-brandit-black">
            {periodoActivo ? fmt(periodoActivo.total_gastado) : "—"}
          </p>
        </div>
      </div>

      {/* New period */}
      {!hasOpen && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-8">
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-4">Nuevo Período</p>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-xs text-gray-400 block mb-1">Fondo Inicial (USD)</label>
              <input
                type="number"
                value={fondoInicial}
                onChange={(e) => setFondoInicial(e.target.value)}
                className="w-full border-b border-gray-200 py-2 text-sm outline-none focus:border-brandit-orange transition-colors bg-transparent"
                placeholder="200.00"
              />
            </div>
            <button
              onClick={crearPeriodo}
              disabled={creating}
              className="bg-brandit-orange text-white rounded-xl px-6 py-2.5 text-sm font-medium hover:bg-brandit-orange/90 transition-colors disabled:opacity-50 mt-4"
            >
              {creating ? "Creando..." : "Crear Período"}
            </button>
          </div>
        </div>
      )}

      {/* Period list */}
      {loading ? (
        <div className="text-center py-24 text-gray-300">Cargando...</div>
      ) : periodos.length === 0 ? (
        <div className="text-center py-24">
          <p className="text-gray-300 text-lg mb-2">No hay períodos de caja</p>
          <p className="text-gray-300 text-sm">Crea el primer período para comenzar</p>
        </div>
      ) : (
        <div>
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-4">Períodos</p>
          <div className="space-y-3">
            {periodos.map((p) => {
              const pct = p.fondo_inicial > 0 ? Math.min((p.total_gastado / p.fondo_inicial) * 100, 100) : 0;
              return (
                <Link
                  key={p.id}
                  href={`/caja/${p.id}`}
                  className="block bg-white rounded-2xl border border-gray-100 px-6 py-5 hover:border-brandit-orange/20 hover:shadow-md transition-all group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-gray-400 bg-gray-50 rounded-lg px-2.5 py-1 group-hover:bg-brandit-orange/5 group-hover:text-brandit-black transition-colors">
                        #{p.numero}
                      </span>
                      <div>
                        <h3 className="font-semibold text-gray-900 text-sm">Período {p.numero}</h3>
                        <p className="text-xs text-gray-400">
                          {p.fecha_apertura}{p.fecha_cierre ? ` → ${p.fecha_cierre}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xs text-gray-400">Saldo</p>
                        <p className={`text-sm font-bold ${p.saldo < 0 ? "text-red-500" : "text-brandit-black"}`}>
                          {fmt(p.saldo)}
                        </p>
                      </div>
                      <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${
                        p.estado === "abierto" ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500"
                      }`}>
                        {p.estado === "abierto" ? "Abierto" : "Cerrado"}
                      </span>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${pct > 90 ? "bg-red-400" : pct > 70 ? "bg-yellow-400" : "bg-brandit-orange"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1.5">
                    <span className="text-[10px] text-gray-400">Gastado: {fmt(p.total_gastado)}</span>
                    <span className="text-[10px] text-gray-400">Fondo: {fmt(p.fondo_inicial)}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Categorías Modal */}
      {showCatModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowCatModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-brandit-black mb-4">Categorías de Gasto</h3>
            <div className="flex gap-2 mb-4">
              <input
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                placeholder="Nueva categoría"
                className="flex-1 border-b border-gray-200 py-2 text-sm outline-none focus:border-brandit-orange transition-colors"
                onKeyDown={(e) => e.key === "Enter" && addCategoria()}
              />
              <button onClick={addCategoria} className="bg-brandit-orange text-white rounded-xl px-4 py-2 text-sm font-medium">
                Agregar
              </button>
            </div>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {categorias.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50">
                  <span className="text-sm text-gray-700">{c.nombre}</span>
                  <button onClick={() => deleteCategoria(c.id)} className="text-xs text-red-400 hover:text-red-600">Eliminar</button>
                </div>
              ))}
              {categorias.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Sin categorías</p>}
            </div>
            <button onClick={() => setShowCatModal(false)} className="mt-4 w-full text-center text-sm text-gray-400 hover:text-gray-600">Cerrar</button>
          </div>
        </div>
      )}

      {/* Responsables Modal */}
      {showRespModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowRespModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-brandit-black mb-4">Responsables</h3>
            <div className="flex gap-2 mb-4">
              <input
                value={newResp}
                onChange={(e) => setNewResp(e.target.value)}
                placeholder="Nuevo responsable"
                className="flex-1 border-b border-gray-200 py-2 text-sm outline-none focus:border-brandit-orange transition-colors"
                onKeyDown={(e) => e.key === "Enter" && addResponsable()}
              />
              <button onClick={addResponsable} className="bg-brandit-orange text-white rounded-xl px-4 py-2 text-sm font-medium">
                Agregar
              </button>
            </div>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {responsables.map((r) => (
                <div key={r.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50">
                  <span className="text-sm text-gray-700">{r.nombre}</span>
                  <button onClick={() => deleteResponsable(r.id)} className="text-xs text-red-400 hover:text-red-600">Eliminar</button>
                </div>
              ))}
              {responsables.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Sin responsables</p>}
            </div>
            <button onClick={() => setShowRespModal(false)} className="mt-4 w-full text-center text-sm text-gray-400 hover:text-gray-600">Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}
