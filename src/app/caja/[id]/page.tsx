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
  estado: string;
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

type PrintView = "none" | "reporte" | "recibo" | "vale" | "vale_entrega" | "comprobante_vuelto";

export default function CajaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [periodo, setPeriodo] = useState<Periodo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState("");
  const [printView, setPrintView] = useState<PrintView>("none");
  const [printGasto, setPrintGasto] = useState<Gasto | null>(null);
  const [showValeModal, setShowValeModal] = useState(false);
  const [vale, setVale] = useState({ beneficiario: "", concepto: "", monto: "", fecha: new Date().toISOString().split("T")[0] });

  const [showHelp, setShowHelp] = useState(false);
  const [showPostGasto, setShowPostGasto] = useState(false);

  // Vale de entrega state for the vale flow
  const [valeEntrega, setValeEntrega] = useState({
    gastoId: "",
    beneficiario: "",
    concepto: "",
    montoGasto: 0,
    montoEntregado: "",
  });

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

  const addGasto = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const subtotal = Number(form.subtotal) || 0;
    const itbmsRate = Number(form.itbms) || 0;
    const total = subtotal + subtotal * (itbmsRate / 100);

    const res = await fetch("/api/caja/gastos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, periodo_id: params.id }),
    });
    const newGasto = await res.json();

    // Prepare vale data in case user wants to print
    setValeEntrega({
      gastoId: newGasto.id || "",
      beneficiario: form.proveedor || form.responsable || "",
      concepto: form.descripcion,
      montoGasto: total,
      montoEntregado: String(total),
    });

    setForm({ fecha: new Date().toISOString().split("T")[0], proveedor: "", categoria: "", descripcion: "", responsable: "", empresa: "", subtotal: "", itbms: "0" });
    setSaving(false);
    await load();
    setShowPostGasto(true);
  };

  const startValeFlow = async () => {
    setShowPostGasto(false);
    // Mark gasto as pendiente since we're doing the vale flow
    if (valeEntrega.gastoId) {
      await fetch(`/api/caja/gastos/${valeEntrega.gastoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "pendiente" }),
      });
      await load();
    }
    setPrintView("vale_entrega");
  };

  const finalizarVale = async () => {
    const montoEntregado = Number(valeEntrega.montoEntregado) || 0;
    const vuelto = montoEntregado - valeEntrega.montoGasto;

    if (vuelto > 0) {
      setPrintView("comprobante_vuelto");
    } else {
      await confirmarVuelto();
    }
  };

  const confirmarVuelto = async () => {
    if (valeEntrega.gastoId) {
      await fetch(`/api/caja/gastos/${valeEntrega.gastoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "completado" }),
      });
    }
    setPrintView("none");
    setValeEntrega({ gastoId: "", beneficiario: "", concepto: "", montoGasto: 0, montoEntregado: "" });
    load();
  };

  const deleteGasto = async (id: string) => {
    if (!confirm("\u00bfEliminar este gasto?")) return;
    await fetch(`/api/caja/gastos/${id}`, { method: "DELETE" });
    load();
  };

  const cerrarPeriodo = async () => {
    if (!confirm("\u00bfCerrar este per\u00edodo? No podr\u00e1 agregar m\u00e1s gastos.")) return;
    await fetch(`/api/caja/periodos/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "cerrado" }),
    });
    load();
  };

  const deletePeriodo = async () => {
    if (!confirm("\u00bfEliminar este per\u00edodo y todos sus gastos?")) return;
    await fetch(`/api/caja/periodos/${params.id}`, { method: "DELETE" });
    router.push("/caja");
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("es-PA", { style: "currency", currency: "USD" }).format(n);

  const calcTotal = () => {
    const s = Number(form.subtotal) || 0;
    return s + s * (Number(form.itbms) / 100);
  };

  const nowStr = () => {
    const d = new Date();
    return d.toLocaleString("es-PA", { dateStyle: "long", timeStyle: "short" });
  };

  if (loading) return <div className="text-center py-24 text-gray-300">Cargando...</div>;
  if (!periodo) return null;

  const pct = periodo.fondo_inicial > 0 ? Math.min((periodo.total_gastado / periodo.fondo_inicial) * 100, 100) : 0;

  // Category summary
  const catSummary: Record<string, number> = {};
  periodo.gastos.forEach((g) => {
    const cat = g.categoria || "Sin categor\u00eda";
    catSummary[cat] = (catSummary[cat] || 0) + g.total;
  });

  // ══════════ PRINT: VALE DE ENTREGA (new flow) ══════════
  if (printView === "vale_entrega") {
    const montoEntregado = Number(valeEntrega.montoEntregado) || 0;
    const vueltoEsperado = montoEntregado - valeEntrega.montoGasto;

    return (
      <div className="max-w-md mx-auto px-4 py-8">
        <div className="bg-white p-8 print:p-4">
          <div className="text-center mb-6 border-b-2 border-brandit-orange pb-4">
            <p className="text-sm font-bold text-brandit-black tracking-tight uppercase">BRAND IT | Confecciones Boston</p>
            <p className="text-sm font-bold text-brandit-black mt-2">VALE DE ENTREGA</p>
          </div>

          <div className="text-right text-xs text-gray-400 mb-4">
            {nowStr()}
          </div>

          <div className="space-y-3 text-sm mb-6">
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <span className="text-gray-500">Beneficiario</span>
              <span className="font-medium">{valeEntrega.beneficiario}</span>
            </div>
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <span className="text-gray-500">Concepto</span>
              <span className="font-medium">{valeEntrega.concepto}</span>
            </div>
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <span className="text-gray-500">Monto del gasto</span>
              <span className="font-bold">{fmt(valeEntrega.montoGasto)}</span>
            </div>
          </div>

          {/* Editable: monto entregado */}
          <div className="bg-gray-50 rounded-xl p-4 mb-6 print:hidden">
            <label className="text-xs text-gray-400 block mb-1">Monto entregado al beneficiario</label>
            <input
              type="number"
              step="0.01"
              value={valeEntrega.montoEntregado}
              onChange={(e) => setValeEntrega({ ...valeEntrega, montoEntregado: e.target.value })}
              className="w-full border-b border-gray-200 py-2 text-lg font-bold outline-none focus:border-brandit-orange transition-colors bg-transparent"
            />
            {vueltoEsperado > 0 && (
              <p className="text-sm text-amber-600 font-semibold mt-2">
                Vuelto esperado: {fmt(vueltoEsperado)}
              </p>
            )}
          </div>

          {/* Print-only: show monto entregado */}
          <div className="hidden print:block mb-6">
            <div className="flex justify-between border-b border-gray-200 pb-2 text-sm">
              <span className="text-gray-500 font-semibold">Monto entregado</span>
              <span className="font-bold text-lg">{fmt(montoEntregado)}</span>
            </div>
            {vueltoEsperado > 0 && (
              <div className="flex justify-between border-b border-gray-200 pb-2 text-sm mt-2">
                <span className="text-gray-500">Vuelto esperado</span>
                <span className="font-semibold text-amber-600">{fmt(vueltoEsperado)}</span>
              </div>
            )}
          </div>

          <div className="mt-10 text-center">
            <div className="border-t border-gray-400 w-48 mx-auto mb-1"></div>
            <p className="text-xs text-gray-500">Firma del beneficiario</p>
          </div>
        </div>

        <div className="flex gap-3 mt-4 print:hidden">
          <button onClick={() => window.print()} className="bg-brandit-orange text-white rounded-xl px-6 py-2.5 text-sm font-medium hover:bg-brandit-orange/90">
            Imprimir
          </button>
          <button
            onClick={finalizarVale}
            className="bg-green-600 text-white rounded-xl px-6 py-2.5 text-sm font-medium hover:bg-green-700"
          >
            El beneficiario firm\u00f3 \u2014 Finalizar
          </button>
          <button onClick={() => { setPrintView("none"); }} className="text-sm text-gray-400 hover:text-brandit-black">
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  // ══════════ PRINT: COMPROBANTE DE VUELTO ══════════
  if (printView === "comprobante_vuelto") {
    const montoEntregado = Number(valeEntrega.montoEntregado) || 0;
    const vueltoDevuelto = montoEntregado - valeEntrega.montoGasto;

    return (
      <div className="max-w-md mx-auto px-4 py-8">
        <div className="bg-white p-8 print:p-4">
          <div className="text-center mb-6 border-b-2 border-brandit-orange pb-4">
            <p className="text-sm font-bold text-brandit-black tracking-tight uppercase">BRAND IT | Confecciones Boston</p>
            <p className="text-sm font-bold text-brandit-black mt-2">COMPROBANTE DE VUELTO</p>
          </div>

          <div className="text-right text-xs text-gray-400 mb-4">
            {nowStr()}
          </div>

          <div className="space-y-3 text-sm mb-6">
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <span className="text-gray-500">Beneficiario</span>
              <span className="font-medium">{valeEntrega.beneficiario}</span>
            </div>
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <span className="text-gray-500">Concepto</span>
              <span className="font-medium">{valeEntrega.concepto}</span>
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-500">Monto entregado</span>
              <span>{fmt(montoEntregado)}</span>
            </div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-500">Monto del gasto</span>
              <span>{fmt(valeEntrega.montoGasto)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold border-t border-gray-200 pt-2 mt-2">
              <span>Vuelto devuelto</span>
              <span className="text-green-600">{fmt(vueltoDevuelto)}</span>
            </div>
          </div>

          <div className="mt-10 text-center">
            <div className="border-t border-gray-400 w-48 mx-auto mb-1"></div>
            <p className="text-xs text-gray-500">Firma de quien recibe el vuelto</p>
          </div>
        </div>

        <div className="flex gap-3 mt-4 print:hidden">
          <button onClick={() => window.print()} className="bg-brandit-orange text-white rounded-xl px-6 py-2.5 text-sm font-medium hover:bg-brandit-orange/90">
            Imprimir vuelto
          </button>
          <button
            onClick={confirmarVuelto}
            className="bg-green-600 text-white rounded-xl px-6 py-2.5 text-sm font-medium hover:bg-green-700"
          >
            Confirmar vuelto recibido \u2014 Cerrar
          </button>
        </div>
      </div>
    );
  }

  // ══════════ PRINT: REPORTE ══════════
  if (printView === "reporte") {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white p-8 print:p-4">
          <div className="text-center mb-6 border-b-2 border-brandit-orange pb-4">
            <p className="text-sm font-bold text-brandit-black tracking-tight uppercase">BRAND IT | Confecciones Boston</p>
            <p className="text-sm font-bold text-brandit-black mt-2">REPORTE DE CAJA MENUDA</p>
          </div>

          <div className="flex justify-between text-sm mb-6">
            <div>
              <p><span className="font-semibold">Per\u00edodo:</span> N\u00b0{periodo.numero}</p>
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
                <th className="py-2 font-semibold">Descripci\u00f3n</th>
                <th className="py-2 font-semibold">Categor\u00eda</th>
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
            <p className="text-xs font-semibold text-gray-500 mb-2">Resumen por Categor\u00eda</p>
            <table className="w-full text-xs">
              <tbody>
                {Object.entries(catSummary).sort((a, b) => b[1] - a[1]).map(([cat, total]) => (
                  <tr key={cat} className="border-b border-gray-100">
                    <td className="py-1">{cat}</td>
                    <td className="py-1 text-right font-semibold">{fmt(total)}</td>
                  </tr>
                ))}
              </tbody>
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
          <button onClick={() => setPrintView("none")} className="text-sm text-gray-400 hover:text-brandit-black">\u2190 Volver</button>
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
            <p className="text-sm font-bold text-brandit-black tracking-tight uppercase">BRAND IT | Confecciones Boston</p>
            <p className="text-sm font-bold text-brandit-black mt-2">COMPROBANTE DE CAJA MENUDA</p>
          </div>

          <div className="text-right text-xs text-gray-400 mb-4">
            N\u00b0 {printGasto.id.substring(0, 8).toUpperCase()}
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
              <span className="text-gray-500">Descripci\u00f3n</span>
              <span className="font-medium">{printGasto.descripcion}</span>
            </div>
            <div className="flex justify-between border-b border-gray-100 pb-1">
              <span className="text-gray-500">Categor\u00eda</span>
              <span className="font-medium">{printGasto.categoria || "\u2014"}</span>
            </div>
            <div className="flex justify-between border-b border-gray-100 pb-1">
              <span className="text-gray-500">Responsable</span>
              <span className="font-medium">{printGasto.responsable || "\u2014"}</span>
            </div>
            <div className="flex justify-between border-b border-gray-100 pb-1">
              <span className="text-gray-500">Empresa</span>
              <span className="font-medium">{printGasto.empresa || "\u2014"}</span>
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
          <button onClick={() => { setPrintView("none"); setPrintGasto(null); }} className="text-sm text-gray-400 hover:text-brandit-black">\u2190 Volver</button>
          <button onClick={() => window.print()} className="bg-brandit-orange text-white rounded-xl px-6 py-2 text-sm font-medium">Imprimir</button>
        </div>
      </div>
    );
  }

  // ══════════ PRINT: VALE DE ENTREGA (standalone) ══════════
  if (printView === "vale") {
    return (
      <div className="max-w-md mx-auto px-4 py-8">
        <div className="bg-white p-8 print:p-4">
          <div className="text-center mb-6 border-b-2 border-brandit-orange pb-4">
            <p className="text-sm font-bold text-brandit-black tracking-tight uppercase">BRAND IT | Confecciones Boston</p>
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
            <p className="text-xs text-gray-500">Recib\u00ed conforme</p>
            <p className="text-[10px] text-gray-400 mt-1">Fecha: _______________</p>
          </div>
        </div>

        <div className="flex gap-3 mt-4 print:hidden">
          <button onClick={() => setPrintView("none")} className="text-sm text-gray-400 hover:text-brandit-black">\u2190 Volver</button>
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
        <Link href="/caja" className="text-sm text-gray-400 hover:text-brandit-black transition-colors">\u2190 Caja</Link>
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
          <h1 className="text-3xl font-bold text-brandit-black tracking-tight">Per\u00edodo N\u00b0{periodo.numero}</h1>
          <p className="text-sm text-gray-400 mt-1">
            {periodo.fecha_apertura}{periodo.fecha_cierre ? ` \u2192 ${periodo.fecha_cierre}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowHelp(true)}
            className="border border-gray-200 text-gray-600 rounded-xl px-4 py-2 text-sm hover:border-gray-300 transition-colors"
            title="Como usar Caja Menuda">
            ?
          </button>
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
              Cerrar Per\u00edodo
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
              <label className="text-xs text-gray-400 block mb-1">Categor\u00eda</label>
              <input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                placeholder="Ej: Limpieza, Oficina..."
                className="w-full border-b border-gray-200 py-2 text-sm outline-none focus:border-brandit-orange transition-colors bg-transparent" />
            </div>
            {/* Row 2 */}
            <div>
              <label className="text-xs text-gray-400 block mb-1">Descripci\u00f3n</label>
              <input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} required
                placeholder="Detalle del gasto"
                className="w-full border-b border-gray-200 py-2 text-sm outline-none focus:border-brandit-orange transition-colors bg-transparent" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Responsable</label>
              <input value={form.responsable} onChange={(e) => setForm({ ...form, responsable: e.target.value })}
                placeholder="Nombre del responsable"
                className="w-full border-b border-gray-200 py-2 text-sm outline-none focus:border-brandit-orange transition-colors bg-transparent" />
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

      {/* Expenses list */}
      {periodo.gastos.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-300 text-lg mb-1">No hay gastos registrados</p>
          {periodo.estado === "abierto" && (
            <p className="text-sm text-gray-300">Usa el formulario de arriba para agregar el primer gasto</p>
          )}
        </div>
      ) : (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs uppercase tracking-widest text-gray-400">{periodo.gastos.length} Gastos</p>
            <p className="text-sm font-bold text-brandit-black">Total: {fmt(periodo.total_gastado)}</p>
          </div>

          {/* ── MOBILE: Card layout ── */}
          <div className="sm:hidden space-y-2">
            {periodo.gastos.map((g) => (
              <div key={g.id} className="bg-white rounded-xl shadow-sm p-4 border border-gray-50">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {g.categoria ? (
                      <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-brandit-orange/10 text-brandit-orange">
                        {g.categoria}
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                        Sin cat.
                      </span>
                    )}
                    {g.estado === "pendiente" && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">
                        Pendiente vuelto
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">{g.fecha}</span>
                </div>
                <p className="text-lg font-bold text-brandit-black mb-1">{fmt(g.total)}</p>
                <p className="text-sm text-gray-600 truncate">{g.descripcion}</p>
                {g.proveedor && <p className="text-xs text-gray-400 mt-0.5">{g.proveedor}</p>}
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-50">
                  <div className="flex items-center gap-2">
                    {g.responsable && <span className="text-xs text-gray-400">{g.responsable}</span>}
                    {g.empresa && <span className="text-xs text-gray-400">{g.empresa}</span>}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => { setPrintGasto(g); setPrintView("recibo"); }}
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 hover:bg-brandit-orange/10 hover:text-brandit-orange transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                    </button>
                    {periodo.estado === "abierto" && (
                      <button onClick={() => deleteGasto(g.id)}
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── DESKTOP: Table layout ── */}
          <div className="hidden sm:block bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-brandit-black text-white text-left">
                    <th className="px-4 py-3 text-xs font-semibold">Fecha</th>
                    <th className="px-4 py-3 text-xs font-semibold">Descripci&oacute;n</th>
                    <th className="px-4 py-3 text-xs font-semibold">Categor&iacute;a</th>
                    <th className="px-4 py-3 text-xs font-semibold">Proveedor</th>
                    <th className="px-4 py-3 text-xs font-semibold text-right">Total</th>
                    <th className="px-4 py-3 text-xs font-semibold">Estado</th>
                    <th className="px-4 py-3 text-xs font-semibold text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {periodo.gastos.map((g, i) => (
                    <tr key={g.id} className={`border-b border-gray-50 hover:bg-gray-50/50 ${i % 2 === 1 ? "bg-gray-50/30" : "bg-white"}`}>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">{g.fecha}</td>
                      <td className="px-4 py-3">
                        <p className="text-gray-900 font-medium">{g.descripcion}</p>
                        {g.responsable && <p className="text-xs text-gray-400 mt-0.5">{g.responsable} {g.empresa ? `\u2022 ${g.empresa}` : ""}</p>}
                      </td>
                      <td className="px-4 py-3">
                        {g.categoria ? (
                          <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-brandit-orange/10 text-brandit-orange">
                            {g.categoria}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">&mdash;</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-sm">{g.proveedor || "\u2014"}</td>
                      <td className="px-4 py-3 text-right font-bold text-brandit-black">{fmt(g.total)}</td>
                      <td className="px-4 py-3">
                        {g.estado === "pendiente" ? (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">
                            Pendiente vuelto
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-600">
                            Completado
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => { setPrintGasto(g); setPrintView("recibo"); }}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-brandit-orange/10 hover:text-brandit-orange transition-colors"
                            title="Recibo">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                            </svg>
                          </button>
                          {periodo.estado === "abierto" && (
                            <button onClick={() => deleteGasto(g.id)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                              title="Eliminar">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50">
                    <td colSpan={4} className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Total Gastado:</td>
                    <td className="px-4 py-3 text-right font-bold text-brandit-black">{fmt(periodo.total_gastado)}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Category summary */}
      {Object.keys(catSummary).length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-4">Resumen por Categor\u00eda</p>
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

      {/* Post-gasto modal: ask what to do next */}
      {showPostGasto && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowPostGasto(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-5">
              <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-brandit-black">Gasto registrado</h3>
              <p className="text-sm text-gray-400 mt-1">Necesitas imprimir un vale de entrega?</p>
            </div>
            <div className="space-y-2">
              <button
                onClick={startValeFlow}
                className="w-full bg-brandit-orange text-white rounded-xl px-4 py-3 text-sm font-medium hover:bg-brandit-orange/90 transition-colors text-left"
              >
                <span className="font-bold">Imprimir vale de entrega</span>
                <br />
                <span className="text-xs text-white/70">Le vas a dar dinero a alguien y necesitas que firme</span>
              </button>
              <button
                onClick={() => { setShowPostGasto(false); setPrintGasto(periodo?.gastos.find(g => g.id === valeEntrega.gastoId) || null); if (periodo?.gastos.find(g => g.id === valeEntrega.gastoId)) setPrintView("recibo"); }}
                className="w-full border border-gray-200 text-gray-700 rounded-xl px-4 py-3 text-sm font-medium hover:border-gray-300 transition-colors text-left"
              >
                <span className="font-bold">Solo imprimir comprobante</span>
                <br />
                <span className="text-xs text-gray-400">El gasto ya se hizo, solo necesitas el recibo</span>
              </button>
              <button
                onClick={() => setShowPostGasto(false)}
                className="w-full text-sm text-gray-400 hover:text-brandit-black py-2 transition-colors"
              >
                No necesito nada, listo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Help modal */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowHelp(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-brandit-black">Como usar Caja Menuda</h3>
              <button onClick={() => setShowHelp(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>

            <div className="space-y-4 text-sm text-gray-600">
              <div className="bg-amber-50 rounded-xl p-4">
                <p className="font-bold text-amber-800 mb-1">Que es un periodo?</p>
                <p className="text-amber-700">Es un ciclo de caja menuda. Se abre con un fondo inicial (ej: $200) y se van registrando gastos hasta que se acabe o se cierre.</p>
              </div>

              <div>
                <p className="font-bold text-brandit-black mb-2">Flujo normal:</p>
                <ol className="space-y-3">
                  <li className="flex gap-3">
                    <span className="bg-brandit-orange text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                    <div>
                      <p className="font-semibold text-gray-800">Registrar el gasto</p>
                      <p className="text-gray-500">Llena el formulario con fecha, proveedor, monto, etc. y dale Agregar Gasto.</p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="bg-brandit-orange text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                    <div>
                      <p className="font-semibold text-gray-800">Decidir que hacer</p>
                      <p className="text-gray-500">Te va a preguntar si necesitas imprimir un vale de entrega, un comprobante, o nada.</p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="bg-brandit-orange text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                    <div>
                      <p className="font-semibold text-gray-800">Listo</p>
                      <p className="text-gray-500">El gasto queda registrado y se descuenta del saldo.</p>
                    </div>
                  </li>
                </ol>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <p className="font-bold text-brandit-black mb-2">Cuando usar el vale de entrega?</p>
                <p className="text-gray-500 mb-2">Cuando le vas a dar dinero de la caja a alguien para que vaya a comprar algo. El vale es para que firme que recibio el dinero.</p>
                <p className="text-gray-500">Si le diste de mas (ej: el gasto era $15 pero le diste $20), el sistema te ayuda a registrar el vuelto con otro comprobante.</p>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <p className="font-bold text-brandit-black mb-2">Botones del header:</p>
                <ul className="space-y-1.5 text-gray-500">
                  <li><span className="font-semibold text-gray-700">Imprimir Reporte</span> — genera un reporte completo del periodo para imprimir</li>
                  <li><span className="font-semibold text-gray-700">Vale de Entrega</span> — crea un vale suelto (sin registrar gasto)</li>
                  <li><span className="font-semibold text-gray-700">Cerrar Periodo</span> — cierra el periodo para que no se agreguen mas gastos (solo admin)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Vale Modal (standalone) */}
      {showValeModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowValeModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-brandit-black mb-4">Vale de Entrega</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Beneficiario</label>
                <input value={vale.beneficiario} onChange={(e) => setVale({ ...vale, beneficiario: e.target.value })}
                  placeholder="Nombre del beneficiario"
                  className="w-full border-b border-gray-200 py-2 text-sm outline-none focus:border-brandit-orange transition-colors bg-transparent" />
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
