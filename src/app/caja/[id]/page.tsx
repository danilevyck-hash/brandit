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
  proveedor: string;
  categoria: string;
  responsable: string;
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

type Categoria = { id: string; nombre: string };
type Responsable = { id: string; nombre: string };

type PrintView = "none" | "reporte" | "recibo" | "vale";

export default function CajaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [periodo, setPeriodo] = useState<Periodo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState("");
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [responsables, setResponsables] = useState<Responsable[]>([]);
  const [printView, setPrintView] = useState<PrintView>("none");
  const [printGasto, setPrintGasto] = useState<Gasto | null>(null);
  const [showValeModal, setShowValeModal] = useState(false);
  const [vale, setVale] = useState({ beneficiario: "", concepto: "", monto: "", fecha: new Date().toISOString().split("T")[0] });

  const [form, setForm] = useState({
    fecha: new Date().toISOString().split("T")[0],
    proveedor: "",
    categoria: "",
    descripcion: "",
    responsable: "",
    empresa: "",
    subtotal: "",
    itbms: "0",
  });

  useEffect(() => { setRole(localStorage.getItem("brandit_role") || ""); }, []);
  const isAdmin = role === "admin";

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/caja/periodos/${params.id}`);
    const data = await res.json();
    if (data.error) { router.push("/caja"); return; }
    setPeriodo(data);
    setLoading(false);
  }, [params.id, router]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch("/api/caja/categorias").then((r) => r.json()).then((d) => setCategorias(Array.isArray(d) ? d : []));
    fetch("/api/caja/responsables").then((r) => r.json()).then((d) => setResponsables(Array.isArray(d) ? d : []));
  }, []);

  const addGasto = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/caja/gastos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, periodo_id: params.id }),
    });
    setForm({ fecha: new Date().toISOString().split("T")[0], proveedor: "", categoria: "", descripcion: "", responsable: "", empresa: "", subtotal: "", itbms: "0" });
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

  const calcTotal = () => {
    const s = Number(form.subtotal) || 0;
    return s + s * (Number(form.itbms) / 100);
  };

  if (loading) return <div className="text-center py-24 text-gray-300">Cargando...</div>;
  if (!periodo) return null;

  const pct = periodo.fondo_inicial > 0 ? Math.min((periodo.total_gastado / periodo.fondo_inicial) * 100, 100) : 0;

  // Category summary
  const catSummary: Record<string, number> = {};
  periodo.gastos.forEach((g) => {
    const cat = g.categoria || "Sin categoría";
    catSummary[cat] = (catSummary[cat] || 0) + g.total;
  });

  // ══════════ PRINT: REPORTE ══════════
  if (printView === "reporte") {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white p-8 print:p-4">
          <div className="text-center mb-6 border-b-2 border-brandit-orange pb-4">
            <h1 className="text-xl font-bold tracking-tight uppercase">
              <span className="text-brandit-black">BRAND</span>
              <span className="text-brandit-blue">/</span>
              <span className="text-brandit-black">IT</span>
              <span className="text-brandit-orange">.</span>
            </h1>
            <p className="text-[10px] text-gray-500 font-medium">Confecciones Boston</p>
            <p className="text-sm font-bold text-brandit-black mt-2">REPORTE DE CAJA MENUDA</p>
          </div>

          <div className="flex justify-between text-sm mb-6">
            <div>
              <p><span className="font-semibold">Período:</span> N°{periodo.numero}</p>
              <p><span className="font-semibold">Apertura:</span> {periodo.fecha_apertura}</p>
              {periodo.fecha_cierre && <p><span className="font-semibold">Cierre:</span> {periodo.fecha_cierre}</p>}
            </div>
            <div className="text-right">
              <p><span className="font-semibold">Fondo Inicial:</span> {fmt(periodo.fondo_inicial)}</p>
              <p><span className="font-semibold">Total Gastado:</span> {fmt(periodo.total_gastado)}</p>
              <p className="font-bold"><span className="font-semibold">Saldo:</span> {fmt(periodo.saldo)}</p>
            </div>
          </div>

          <table className="w-full text-xs mb-6">
            <thead>
              <tr className="border-b-2 border-brandit-orange text-left">
                <th className="py-2 font-semibold">Fecha</th>
                <th className="py-2 font-semibold">Proveedor</th>
                <th className="py-2 font-semibold">Descripción</th>
                <th className="py-2 font-semibold">Categoría</th>
                <th className="py-2 font-semibold">Responsable</th>
                <th className="py-2 font-semibold">Empresa</th>
                <th className="py-2 text-right font-semibold">Subtotal</th>
                <th className="py-2 text-right font-semibold">ITBMS</th>
                <th className="py-2 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {periodo.gastos.map((g) => (
                <tr key={g.id} className="border-b border-gray-200">
                  <td className="py-1.5">{g.fecha}</td>
                  <td className="py-1.5">{g.proveedor}</td>
                  <td className="py-1.5">{g.descripcion}</td>
                  <td className="py-1.5">{g.categoria}</td>
                  <td className="py-1.5">{g.responsable}</td>
                  <td className="py-1.5">{g.empresa}</td>
                  <td className="py-1.5 text-right">{fmt(g.subtotal)}</td>
                  <td className="py-1.5 text-right">{fmt(g.itbms)}</td>
                  <td className="py-1.5 text-right font-semibold">{fmt(g.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-brandit-orange font-bold text-sm">
                <td colSpan={8} className="py-2 text-right">Total Gastado:</td>
                <td className="py-2 text-right">{fmt(periodo.total_gastado)}</td>
              </tr>
            </tfoot>
          </table>

          {/* Category summary */}
          <div className="mb-6">
            <p className="text-xs font-semibold text-gray-500 mb-2">Resumen por Categoría</p>
            <table className="w-full text-xs">
              {Object.entries(catSummary).sort((a, b) => b[1] - a[1]).map(([cat, total]) => (
                <tr key={cat} className="border-b border-gray-100">
                  <td className="py-1">{cat}</td>
                  <td className="py-1 text-right font-semibold">{fmt(total)}</td>
                </tr>
              ))}
            </table>
          </div>

          <div className="text-right text-sm font-bold mb-8">
            Saldo Final: {fmt(periodo.saldo)}
          </div>

          <div className="mt-12 grid grid-cols-2 gap-16 text-xs text-gray-500">
            <div className="text-center">
              <div className="border-t border-gray-400 w-full mb-1"></div>
              Preparado por
            </div>
            <div className="text-center">
              <div className="border-t border-gray-400 w-full mb-1"></div>
              Revisado por
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-4 print:hidden">
          <button onClick={() => setPrintView("none")} className="text-sm text-gray-400 hover:text-brandit-black">← Volver</button>
          <button onClick={() => window.print()} className="bg-brandit-orange text-white rounded-xl px-6 py-2 text-sm font-medium">Imprimir</button>
        </div>
      </div>
    );
  }

  // ══════════ PRINT: RECIBO INDIVIDUAL ══════════
  if (printView === "recibo" && printGasto) {
    return (
      <div className="max-w-md mx-auto px-4 py-8">
        <div className="bg-white p-8 print:p-4">
          <div className="text-center mb-6 border-b-2 border-brandit-orange pb-4">
            <h1 className="text-xl font-bold tracking-tight uppercase">
              <span className="text-brandit-black">BRAND</span>
              <span className="text-brandit-blue">/</span>
              <span className="text-brandit-black">IT</span>
              <span className="text-brandit-orange">.</span>
            </h1>
            <p className="text-[10px] text-gray-500 font-medium">Confecciones Boston</p>
            <p className="text-sm font-bold text-brandit-black mt-2">COMPROBANTE DE CAJA MENUDA</p>
          </div>

          <div className="text-right text-xs text-gray-400 mb-4">
            N° {printGasto.id.substring(0, 8).toUpperCase()}
          </div>

          <div className="space-y-2 text-sm mb-6">
            <div className="flex justify-between border-b border-gray-100 pb-1">
              <span className="text-gray-500">Fecha</span>
              <span className="font-medium">{printGasto.fecha}</span>
            </div>
            <div className="flex justify-between border-b border-gray-100 pb-1">
              <span className="text-gray-500">Proveedor</span>
              <span className="font-medium">{printGasto.proveedor || printGasto.empresa}</span>
            </div>
            <div className="flex justify-between border-b border-gray-100 pb-1">
              <span className="text-gray-500">Descripción</span>
              <span className="font-medium">{printGasto.descripcion}</span>
            </div>
            <div className="flex justify-between border-b border-gray-100 pb-1">
              <span className="text-gray-500">Categoría</span>
              <span className="font-medium">{printGasto.categoria || "—"}</span>
            </div>
            <div className="flex justify-between border-b border-gray-100 pb-1">
              <span className="text-gray-500">Responsable</span>
              <span className="font-medium">{printGasto.responsable || "—"}</span>
            </div>
            <div className="flex justify-between border-b border-gray-100 pb-1">
              <span className="text-gray-500">Empresa</span>
              <span className="font-medium">{printGasto.empresa || "—"}</span>
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-500">Subtotal</span>
              <span>{fmt(printGasto.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-500">ITBMS</span>
              <span>{fmt(printGasto.itbms)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold border-t border-gray-200 pt-1">
              <span>Total</span>
              <span>{fmt(printGasto.total)}</span>
            </div>
          </div>

          <div className="mt-10 text-center">
            <div className="border-t border-gray-400 w-48 mx-auto mb-1"></div>
            <p className="text-xs text-gray-500">Firma del responsable</p>
          </div>

          <p className="text-[10px] text-gray-400 text-center mt-6">
            Este documento sirve como comprobante de gasto de caja menuda
          </p>
        </div>

        <div className="flex gap-3 mt-4 print:hidden">
          <button onClick={() => { setPrintView("none"); setPrintGasto(null); }} className="text-sm text-gray-400 hover:text-brandit-black">← Volver</button>
          <button onClick={() => window.print()} className="bg-brandit-orange text-white rounded-xl px-6 py-2 text-sm font-medium">Imprimir</button>
        </div>
      </div>
    );
  }

  // ══════════ PRINT: VALE DE ENTREGA ══════════
  if (printView === "vale") {
    return (
      <div className="max-w-md mx-auto px-4 py-8">
        <div className="bg-white p-8 print:p-4">
          <div className="text-center mb-6 border-b-2 border-brandit-orange pb-4">
            <h1 className="text-xl font-bold tracking-tight uppercase">
              <span className="text-brandit-black">BRAND</span>
              <span className="text-brandit-blue">/</span>
              <span className="text-brandit-black">IT</span>
              <span className="text-brandit-orange">.</span>
            </h1>
            <p className="text-[10px] text-gray-500 font-medium">Confecciones Boston</p>
            <p className="text-sm font-bold text-brandit-black mt-2">VALE DE ENTREGA DE CAJA MENUDA</p>
          </div>

          <div className="space-y-3 text-sm mb-8">
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <span className="text-gray-500">Fecha</span>
              <span className="font-medium">{vale.fecha}</span>
            </div>
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <span className="text-gray-500">Beneficiario</span>
              <span className="font-medium">{vale.beneficiario}</span>
            </div>
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <span className="text-gray-500">Concepto</span>
              <span className="font-medium">{vale.concepto}</span>
            </div>
            <div className="flex justify-between border-b border-gray-200 pb-2">
              <span className="text-gray-500 font-semibold">Monto</span>
              <span className="font-bold text-lg">{fmt(Number(vale.monto) || 0)}</span>
            </div>
          </div>

          <div className="mt-12 text-center">
            <div className="border-t border-gray-400 w-48 mx-auto mb-1"></div>
            <p className="text-xs text-gray-500">Recibí conforme</p>
            <p className="text-[10px] text-gray-400 mt-1">Fecha: _______________</p>
          </div>
        </div>

        <div className="flex gap-3 mt-4 print:hidden">
          <button onClick={() => setPrintView("none")} className="text-sm text-gray-400 hover:text-brandit-black">← Volver</button>
          <button onClick={() => window.print()} className="bg-brandit-orange text-white rounded-xl px-6 py-2 text-sm font-medium">Imprimir</button>
        </div>
      </div>
    );
  }

  // ══════════ MAIN VIEW ══════════
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link href="/caja" className="text-sm text-gray-400 hover:text-brandit-black transition-colors">← Caja</Link>
      </div>

      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <p className="text-xs uppercase tracking-widest text-gray-400">Caja Menuda</p>
            <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${
              periodo.estado === "abierto" ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500"
            }`}>
              {periodo.estado === "abierto" ? "Abierto" : "Cerrado"}
            </span>
          </div>
          <h1 className="text-3xl font-bold text-brandit-black tracking-tight">Período N°{periodo.numero}</h1>
          <p className="text-sm text-gray-400 mt-1">
            {periodo.fecha_apertura}{periodo.fecha_cierre ? ` → ${periodo.fecha_cierre}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setPrintView("reporte")}
            className="border border-gray-200 text-gray-600 rounded-xl px-4 py-2 text-sm hover:border-gray-300 transition-colors">
            Imprimir Reporte
          </button>
          <button onClick={() => setShowValeModal(true)}
            className="border border-gray-200 text-gray-600 rounded-xl px-4 py-2 text-sm hover:border-gray-300 transition-colors">
            Vale de Entrega
          </button>
          {periodo.estado === "abierto" && isAdmin && (
            <button onClick={cerrarPeriodo}
              className="border border-gray-200 text-gray-600 rounded-xl px-4 py-2 text-sm hover:border-brandit-orange hover:text-brandit-orange transition-colors">
              Cerrar Período
            </button>
          )}
          {periodo.estado === "cerrado" && isAdmin && (
            <button onClick={deletePeriodo}
              className="border border-gray-200 text-red-400 rounded-xl px-4 py-2 text-sm hover:text-red-600 hover:border-red-200 transition-colors">
              Eliminar
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4 mb-2">
        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-2">Fondo Inicial</p>
          <p className="text-3xl font-bold text-brandit-black">{fmt(periodo.fondo_inicial)}</p>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-2">Total Gastado</p>
          <p className="text-3xl font-bold text-brandit-black">{fmt(periodo.total_gastado)}</p>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-2">Saldo Restante</p>
          <p className={`text-3xl font-bold ${periodo.saldo < 0 ? "text-red-500" : "text-green-600"}`}>
            {fmt(periodo.saldo)}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-8">
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${pct > 90 ? "bg-red-400" : pct > 70 ? "bg-yellow-400" : "bg-brandit-orange"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-[10px] text-gray-400 mt-1 text-right">{pct.toFixed(0)}% utilizado</p>
      </div>

      {/* Add expense form */}
      {periodo.estado === "abierto" && (
        <form onSubmit={addGasto} className="bg-white rounded-2xl border border-gray-100 p-6 mb-8">
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-4">Registrar Gasto</p>
          <div className="grid grid-cols-3 gap-x-6 gap-y-4 mb-4">
            {/* Row 1 */}
            <div>
              <label className="text-xs text-gray-400 block mb-1">Fecha</label>
              <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} required
                className="w-full border-b border-gray-200 py-2 text-sm outline-none focus:border-brandit-orange transition-colors bg-transparent" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Proveedor</label>
              <input value={form.proveedor} onChange={(e) => setForm({ ...form, proveedor: e.target.value })}
                placeholder="Nombre del proveedor"
                className="w-full border-b border-gray-200 py-2 text-sm outline-none focus:border-brandit-orange transition-colors bg-transparent" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Categoría</label>
              <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                className="w-full border-b border-gray-200 py-2 text-sm outline-none focus:border-brandit-orange transition-colors bg-transparent">
                <option value="">Seleccionar...</option>
                {categorias.map((c) => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
              </select>
            </div>
            {/* Row 2 */}
            <div>
              <label className="text-xs text-gray-400 block mb-1">Descripción</label>
              <input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} required
                placeholder="Detalle del gasto"
                className="w-full border-b border-gray-200 py-2 text-sm outline-none focus:border-brandit-orange transition-colors bg-transparent" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Responsable</label>
              <select value={form.responsable} onChange={(e) => setForm({ ...form, responsable: e.target.value })}
                className="w-full border-b border-gray-200 py-2 text-sm outline-none focus:border-brandit-orange transition-colors bg-transparent">
                <option value="">Seleccionar...</option>
                {responsables.map((r) => <option key={r.id} value={r.nombre}>{r.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Empresa</label>
              <input value={form.empresa} onChange={(e) => setForm({ ...form, empresa: e.target.value })}
                placeholder="Empresa"
                className="w-full border-b border-gray-200 py-2 text-sm outline-none focus:border-brandit-orange transition-colors bg-transparent" />
            </div>
            {/* Row 3 */}
            <div>
              <label className="text-xs text-gray-400 block mb-1">Subtotal</label>
              <input type="number" step="0.01" value={form.subtotal} onChange={(e) => setForm({ ...form, subtotal: e.target.value })} required
                placeholder="0.00"
                className="w-full border-b border-gray-200 py-2 text-sm outline-none focus:border-brandit-orange transition-colors bg-transparent" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">ITBMS</label>
              <select value={form.itbms} onChange={(e) => setForm({ ...form, itbms: e.target.value })}
                className="w-full border-b border-gray-200 py-2 text-sm outline-none focus:border-brandit-orange transition-colors bg-transparent">
                <option value="0">0%</option>
                <option value="7">7%</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Total</label>
              <input type="text" readOnly value={form.subtotal ? fmt(calcTotal()) : ""}
                className="w-full border-b border-gray-200 py-2 text-sm bg-transparent text-gray-500" />
            </div>
          </div>
          <button type="submit" disabled={saving}
            className="bg-brandit-orange text-white rounded-xl px-6 py-2.5 text-sm font-medium hover:bg-brandit-orange/90 transition-colors disabled:opacity-50">
            {saving ? "Guardando..." : "Agregar Gasto"}
          </button>
        </form>
      )}

      {/* Expenses table */}
      {periodo.gastos.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-300">No hay gastos registrados</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-gray-100">
            <p className="text-xs uppercase tracking-widest text-gray-400">{periodo.gastos.length} Gastos</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500">Fecha</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500">Proveedor</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500">Descripción</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500">Categoría</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500">Responsable</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500">Empresa</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-right">Subtotal</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-right">ITBMS</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-right">Total</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {periodo.gastos.map((g) => (
                  <tr key={g.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{g.fecha}</td>
                    <td className="px-4 py-3 text-gray-900">{g.proveedor || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{g.descripcion}</td>
                    <td className="px-4 py-3 text-gray-600">{g.categoria || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{g.responsable || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{g.empresa || "—"}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{fmt(g.subtotal)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{fmt(g.itbms)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{fmt(g.total)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button onClick={() => { setPrintGasto(g); setPrintView("recibo"); }}
                        className="text-xs text-gray-400 hover:text-brandit-orange mr-2">Recibo</button>
                      {periodo.estado === "abierto" && (
                        <button onClick={() => deleteGasto(g.id)} className="text-xs text-red-300 hover:text-red-500">Eliminar</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200 bg-gray-50/50">
                  <td colSpan={6} className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Totales:</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-700">
                    {fmt(periodo.gastos.reduce((s, g) => s + g.subtotal, 0))}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-700">
                    {fmt(periodo.gastos.reduce((s, g) => s + g.itbms, 0))}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-brandit-black">
                    {fmt(periodo.total_gastado)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Category summary */}
      {Object.keys(catSummary).length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-4">Resumen por Categoría</p>
          <div className="space-y-2">
            {Object.entries(catSummary).sort((a, b) => b[1] - a[1]).map(([cat, total]) => {
              const catPct = periodo.total_gastado > 0 ? (total / periodo.total_gastado) * 100 : 0;
              return (
                <div key={cat} className="flex items-center gap-4">
                  <span className="text-sm text-gray-700 w-36 truncate">{cat}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div className="h-2 rounded-full bg-brandit-orange" style={{ width: `${catPct}%` }} />
                  </div>
                  <span className="text-sm font-semibold text-gray-700 w-24 text-right">{fmt(total)}</span>
                  <span className="text-xs text-gray-400 w-12 text-right">{catPct.toFixed(0)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Vale Modal */}
      {showValeModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowValeModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-brandit-black mb-4">Vale de Entrega</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Beneficiario</label>
                <select value={vale.beneficiario} onChange={(e) => setVale({ ...vale, beneficiario: e.target.value })}
                  className="w-full border-b border-gray-200 py-2 text-sm outline-none focus:border-brandit-orange transition-colors bg-transparent">
                  <option value="">Seleccionar...</option>
                  {responsables.map((r) => <option key={r.id} value={r.nombre}>{r.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Concepto</label>
                <input value={vale.concepto} onChange={(e) => setVale({ ...vale, concepto: e.target.value })}
                  className="w-full border-b border-gray-200 py-2 text-sm outline-none focus:border-brandit-orange transition-colors bg-transparent" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Monto</label>
                <input type="number" step="0.01" value={vale.monto} onChange={(e) => setVale({ ...vale, monto: e.target.value })}
                  className="w-full border-b border-gray-200 py-2 text-sm outline-none focus:border-brandit-orange transition-colors bg-transparent" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Fecha</label>
                <input type="date" value={vale.fecha} onChange={(e) => setVale({ ...vale, fecha: e.target.value })}
                  className="w-full border-b border-gray-200 py-2 text-sm outline-none focus:border-brandit-orange transition-colors bg-transparent" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowValeModal(false); setPrintView("vale"); }}
                disabled={!vale.beneficiario || !vale.monto}
                className="bg-brandit-orange text-white rounded-xl px-6 py-2.5 text-sm font-medium hover:bg-brandit-orange/90 transition-colors disabled:opacity-50">
                Imprimir Vale
              </button>
              <button onClick={() => setShowValeModal(false)}
                className="border border-gray-200 text-gray-600 rounded-xl px-4 py-2 text-sm hover:border-gray-300 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
