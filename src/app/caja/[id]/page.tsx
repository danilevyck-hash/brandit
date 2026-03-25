"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

type Gasto = {
  id: string;
  fecha: string;
  empresa: string;
  descripcion: string;
  subtotal: number;
  itbms: number;
  total: number;
};

type Periodo = {
  id: string;
  numero: number;
  fecha_apertura: string;
  fecha_cierre: string | null;
  fondo_inicial: number;
  estado: string;
  gastos: Gasto[];
  total_gastado: number;
  saldo: number;
};

export default function CajaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [periodo, setPeriodo] = useState<Periodo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [printMode, setPrintMode] = useState(false);
  const [role, setRole] = useState("");

  useEffect(() => { setRole(localStorage.getItem("brandit_role") || ""); }, []);

  const isAdmin = role === "admin";
  const [form, setForm] = useState({
    fecha: new Date().toISOString().split("T")[0],
    empresa: "",
    descripcion: "",
    subtotal: "",
    itbms: "0",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/caja/periodos/${params.id}`);
    const data = await res.json();
    if (data.error) {
      router.push("/caja");
      return;
    }
    setPeriodo(data);
    setLoading(false);
  }, [params.id, router]);

  useEffect(() => { load(); }, [load]);

  const addGasto = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/caja/gastos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, periodo_id: params.id }),
    });
    setForm({ fecha: new Date().toISOString().split("T")[0], empresa: "", descripcion: "", subtotal: "", itbms: "0" });
    setShowForm(false);
    setSaving(false);
    load();
  };

  const deleteGasto = async (id: string) => {
    if (!confirm("¿Eliminar este gasto?")) return;
    await fetch(`/api/caja/gastos/${id}`, { method: "DELETE" });
    load();
  };

  const cerrarPeriodo = async () => {
    if (!confirm("¿Cerrar este período? No podrá agregar más gastos.")) return;
    await fetch(`/api/caja/periodos/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "cerrado" }),
    });
    load();
  };

  const deletePeriodo = async () => {
    if (!confirm("¿Eliminar este período y todos sus gastos?")) return;
    await fetch(`/api/caja/periodos/${params.id}`, { method: "DELETE" });
    router.push("/caja");
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("es-PA", { style: "currency", currency: "USD" }).format(n);

  if (loading) return <div className="text-center py-24 text-gray-300 text-lg">Cargando...</div>;
  if (!periodo) return null;

  // Print view
  if (printMode) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl p-8 print:shadow-none print:rounded-none">
          <div className="text-center mb-6 border-b pb-4">
            <h1 className="text-2xl font-extrabold text-navy">Confecciones Boston</h1>
            <p className="text-xs text-gray-400">Reporte de Caja Menuda</p>
          </div>
          <div className="flex justify-between text-sm mb-6">
            <div>
              <p><span className="font-semibold">Período:</span> #{periodo.numero}</p>
              <p><span className="font-semibold">Apertura:</span> {periodo.fecha_apertura}</p>
              {periodo.fecha_cierre && <p><span className="font-semibold">Cierre:</span> {periodo.fecha_cierre}</p>}
            </div>
            <div className="text-right">
              <p><span className="font-semibold">Fondo:</span> {fmt(periodo.fondo_inicial)}</p>
              <p><span className="font-semibold">Gastado:</span> {fmt(periodo.total_gastado)}</p>
              <p className="font-bold"><span className="font-semibold">Saldo:</span> {fmt(periodo.saldo)}</p>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-navy text-left">
                <th className="py-2 text-navy">Fecha</th>
                <th className="py-2 text-navy">Empresa</th>
                <th className="py-2 text-navy">Descripción</th>
                <th className="py-2 text-right text-navy">Subtotal</th>
                <th className="py-2 text-right text-navy">ITBMS</th>
                <th className="py-2 text-right text-navy">Total</th>
              </tr>
            </thead>
            <tbody>
              {periodo.gastos.map((g) => (
                <tr key={g.id} className="border-b border-gray-100">
                  <td className="py-2">{g.fecha}</td>
                  <td className="py-2">{g.empresa}</td>
                  <td className="py-2">{g.descripcion}</td>
                  <td className="py-2 text-right">{fmt(g.subtotal)}</td>
                  <td className="py-2 text-right">{fmt(g.itbms)}</td>
                  <td className="py-2 text-right font-semibold">{fmt(g.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-navy font-bold">
                <td colSpan={5} className="py-2 text-right">Total Gastado:</td>
                <td className="py-2 text-right">{fmt(periodo.total_gastado)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="flex gap-2 mt-4 print:hidden">
          <button onClick={() => setPrintMode(false)} className="text-sm text-gray-500 hover:text-navy">
            ← Volver
          </button>
          <button onClick={() => window.print()} className="bg-navy text-white font-semibold px-6 py-2 rounded-xl text-sm hover:bg-navy/90 transition-colors">
            Imprimir
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Link href="/caja" className="text-sm text-gray-400 hover:text-navy">← Caja</Link>
      </div>

      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Período #{periodo.numero}</h1>
          <p className="text-sm text-gray-400 mt-1">
            {periodo.fecha_apertura}{periodo.fecha_cierre ? ` → ${periodo.fecha_cierre}` : " → abierto"}
            <span className={`ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
              periodo.estado === "abierto" ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500"
            }`}>
              {periodo.estado === "abierto" ? "Abierto" : "Cerrado"}
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setPrintMode(true)} className="text-sm text-gray-500 hover:text-navy border border-gray-200 rounded-xl px-4 py-2">
            Imprimir
          </button>
          {periodo.estado === "abierto" && (
            <>
              <button onClick={cerrarPeriodo} className="text-sm text-gray-500 hover:text-orange-600 border border-gray-200 rounded-xl px-4 py-2">
                Cerrar
              </button>
              {isAdmin && (
                <button onClick={deletePeriodo} className="text-sm text-red-400 hover:text-red-600 border border-gray-200 rounded-xl px-4 py-2">
                  Eliminar
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-gray-50 p-5">
          <p className="text-xs text-gray-400 mb-1">Fondo Inicial</p>
          <p className="text-2xl font-bold text-navy">{fmt(periodo.fondo_inicial)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-50 p-5">
          <p className="text-xs text-gray-400 mb-1">Total Gastado</p>
          <p className="text-2xl font-bold text-gray-900">{fmt(periodo.total_gastado)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-50 p-5">
          <p className="text-xs text-gray-400 mb-1">Saldo</p>
          <p className={`text-2xl font-bold ${periodo.saldo < 0 ? "text-red-500" : "text-green-600"}`}>
            {fmt(periodo.saldo)}
          </p>
        </div>
      </div>

      {/* Add gasto button / form */}
      {periodo.estado === "abierto" && (
        showForm ? (
          <form onSubmit={addGasto} className="bg-white rounded-2xl border border-gray-50 p-5 mb-6">
            <h3 className="font-semibold text-navy mb-4">Nuevo Gasto</h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} required
                className="bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-navy/10 focus:border-navy/30 outline-none" />
              <input placeholder="Empresa" value={form.empresa} onChange={(e) => setForm({ ...form, empresa: e.target.value })} required
                className="bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-navy/10 focus:border-navy/30 outline-none" />
            </div>
            <input placeholder="Descripción" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} required
              className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-navy/10 focus:border-navy/30 outline-none mb-3" />
            <div className="grid grid-cols-2 gap-3 mb-4">
              <input type="number" step="0.01" placeholder="Subtotal" value={form.subtotal} onChange={(e) => setForm({ ...form, subtotal: e.target.value })} required
                className="bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-navy/10 focus:border-navy/30 outline-none" />
              <select value={form.itbms} onChange={(e) => setForm({ ...form, itbms: e.target.value })}
                className="bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-navy/10 focus:border-navy/30 outline-none">
                <option value="0">ITBMS 0%</option>
                <option value="7">ITBMS 7%</option>
              </select>
            </div>
            {form.subtotal && (
              <p className="text-xs text-gray-400 mb-3">
                Total: {fmt(Number(form.subtotal) + Number(form.subtotal) * (Number(form.itbms) / 100))}
              </p>
            )}
            <div className="flex gap-2">
              <button type="submit" disabled={saving}
                className="bg-navy text-white font-semibold px-6 py-2 rounded-xl text-sm hover:bg-navy/90 transition-colors disabled:opacity-50">
                Guardar
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="text-sm text-gray-400 hover:text-gray-600 px-4 py-2">
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <button onClick={() => setShowForm(true)}
            className="bg-navy text-white font-semibold px-6 py-3 rounded-xl text-sm hover:bg-navy/90 transition-colors shadow-sm mb-6">
            + Agregar Gasto
          </button>
        )
      )}

      {/* Gastos list */}
      {periodo.gastos.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400">No hay gastos registrados</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-50 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left">
                <th className="px-5 py-3 text-xs font-semibold text-navy">Fecha</th>
                <th className="px-5 py-3 text-xs font-semibold text-navy">Empresa</th>
                <th className="px-5 py-3 text-xs font-semibold text-navy">Descripción</th>
                <th className="px-5 py-3 text-xs font-semibold text-navy text-right">Subtotal</th>
                <th className="px-5 py-3 text-xs font-semibold text-navy text-right">ITBMS</th>
                <th className="px-5 py-3 text-xs font-semibold text-navy text-right">Total</th>
                {periodo.estado === "abierto" && <th className="px-5 py-3"></th>}
              </tr>
            </thead>
            <tbody>
              {periodo.gastos.map((g) => (
                <tr key={g.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-5 py-3 text-gray-600">{g.fecha}</td>
                  <td className="px-5 py-3 text-gray-900">{g.empresa}</td>
                  <td className="px-5 py-3 text-gray-600">{g.descripcion}</td>
                  <td className="px-5 py-3 text-right text-gray-600">{fmt(g.subtotal)}</td>
                  <td className="px-5 py-3 text-right text-gray-600">{fmt(g.itbms)}</td>
                  <td className="px-5 py-3 text-right font-semibold">{fmt(g.total)}</td>
                  {periodo.estado === "abierto" && (
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => deleteGasto(g.id)} className="text-xs text-red-400 hover:text-red-600">
                        ✕
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
