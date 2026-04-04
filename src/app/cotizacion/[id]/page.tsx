"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Quotation, QuotationItem, PrintJob, QUOTATION_STATUSES } from "@/lib/supabase";
import { formatDate, formatCurrency } from "@/lib/format";
import { generatePDF } from "@/components/QuotationPDF";
import { useToast } from "@/components/Toast";

function materialCost(i: QuotationItem) {
  return i.fabric_qty * i.fabric_price + i.lining_qty * i.lining_price + i.thread_qty * i.thread_price + i.buttons_qty * i.buttons_price + i.packaging_qty * i.packaging_price;
}

function itemTotal(i: QuotationItem) {
  return materialCost(i) + i.labor_cost;
}

function printJobTotal(p: PrintJob) {
  return p.ink_cost + p.paper_cost + p.yard_price * p.yards_qty + p.design_qty * p.design_unit_price;
}

export default function QuotationDetail() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [q, setQ] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/quotations?id=${params.id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.error) {
        toast("Cotización no encontrada", "error");
        router.push("/cotizaciones");
        return;
      }
      setQ(data);
    } catch {
      toast("Error cargando cotización", "error");
      router.push("/cotizaciones");
    } finally {
      setLoading(false);
    }
  }, [params.id, router, toast]);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(status: string) {
    try {
      const res = await fetch("/api/quotations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: q!.id, status }),
      });
      if (!res.ok) throw new Error();
      const label = QUOTATION_STATUSES.find(s => s.value === status)?.label;
      toast(`Estado: ${label}`);
      load();
    } catch {
      toast("Error actualizando estado", "error");
    }
  }

  async function deleteQuotation() {
    setDeleting(true);
    try {
      const res = await fetch("/api/quotations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: q!.id }),
      });
      if (!res.ok) throw new Error();
      toast("Cotización eliminada");
      router.push("/cotizaciones");
    } catch {
      toast("Error eliminando", "error");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  if (loading || !q) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="w-8 h-8 border-3 border-brandit-orange border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400 text-sm">Cargando...</p>
      </div>
    );
  }

  const items = q.items || [];
  const prints = q.print_jobs || [];
  const totalConfection = items.reduce((s, i) => s + itemTotal(i), 0);
  const totalPrint = prints.reduce((s, p) => s + printJobTotal(p), 0);
  const totalSales = items.reduce((s, i) => s + (i.sale_price || 0), 0);
  const grandCost = totalConfection + totalPrint;
  const si = QUOTATION_STATUSES.find(s => s.value === q.status);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Eliminar Cotización</h3>
            <p className="text-sm text-gray-500 mb-6">
              ¿Estás seguro? Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors min-h-[48px]"
              >
                Cancelar
              </button>
              <button
                onClick={deleteQuotation}
                disabled={deleting}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50 min-h-[48px]"
              >
                {deleting ? "Eliminando..." : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-extrabold text-brandit-black tracking-tight">Cotización #{q.id}</h1>
            <span
              className="text-[11px] font-semibold px-3 py-1 rounded-full"
              style={{ backgroundColor: si?.color + "15", color: si?.color }}
            >
              {si?.label}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">{formatDate(q.date)}</p>
        </div>
        <button
          onClick={() => router.push("/cotizaciones")}
          className="text-sm text-gray-400 hover:text-gray-600 font-medium min-h-[44px] px-3 flex items-center"
        >
          ← Volver
        </button>
      </div>

      {/* Status Actions */}
      <div className="flex flex-wrap gap-2 mb-6">
        {QUOTATION_STATUSES.map(s => (
          <button
            key={s.value}
            onClick={() => updateStatus(s.value)}
            disabled={q.status === s.value}
            className="text-sm px-4 py-2 rounded-xl border-2 font-medium transition-all disabled:opacity-30 min-h-[44px]"
            style={{
              borderColor: s.color,
              color: q.status === s.value ? "white" : s.color,
              backgroundColor: q.status === s.value ? s.color : "transparent",
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => generatePDF(q)}
          className="text-sm bg-brandit-orange text-white px-5 py-2.5 rounded-xl font-medium hover:bg-brandit-orange/90 transition-colors min-h-[44px] active:scale-[0.98]"
        >
          Descargar PDF
        </button>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="text-sm text-red-400 hover:text-red-600 px-4 py-2.5 rounded-xl border border-red-100 hover:border-red-300 transition-colors font-medium min-h-[44px]"
        >
          Eliminar
        </button>
      </div>

      {/* Client info */}
      <div className="bg-white rounded-2xl border border-gray-50 p-5 sm:p-6 mb-4 shadow-sm">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-5">
          <div>
            <p className="text-[11px] text-gray-400 uppercase tracking-wider">Cliente</p>
            <p className="text-sm font-semibold text-gray-900 mt-0.5">{q.client?.name || "Sin cliente"}</p>
          </div>
          <div>
            <p className="text-[11px] text-gray-400 uppercase tracking-wider">Fecha</p>
            <p className="text-sm text-gray-700 mt-0.5">{formatDate(q.date)}</p>
          </div>
          {q.client?.phone && (
            <div>
              <p className="text-[11px] text-gray-400 uppercase tracking-wider">Teléfono</p>
              <p className="text-sm text-gray-700 mt-0.5">{q.client.phone}</p>
            </div>
          )}
          {q.notes && (
            <div className="col-span-2 sm:col-span-1">
              <p className="text-[11px] text-gray-400 uppercase tracking-wider">Notas</p>
              <p className="text-sm text-gray-700 mt-0.5">{q.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Confection Items */}
      {items.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-50 p-5 sm:p-6 mb-4 shadow-sm">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Items de Confección ({items.length})</h3>

          {/* Mobile: Card layout */}
          <div className="sm:hidden space-y-3">
            {items.map((item, idx) => {
              const mc = materialCost(item);
              const tc = itemTotal(item);
              const profit = (item.sale_price || 0) - tc;
              const margin = item.sale_price > 0 ? (profit / item.sale_price * 100) : 0;
              return (
                <div key={item.id} className="bg-gray-50 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{item.description}</p>
                      <p className="text-xs text-gray-400">{item.size_color} · Cant: {item.quantity}</p>
                    </div>
                    <span className="text-xs text-gray-300">#{idx + 1}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-gray-400">Mat: </span><span className="font-medium">{formatCurrency(mc)}</span></div>
                    <div><span className="text-gray-400">M.O.: </span><span className="font-medium">{formatCurrency(item.labor_cost)}</span></div>
                    <div><span className="text-gray-400">Costo: </span><span className="font-semibold">{formatCurrency(tc)}</span></div>
                    <div><span className="text-gray-400">Precio: </span><span className="font-medium">{formatCurrency(item.sale_price)}</span></div>
                  </div>
                  <div className="flex justify-between text-xs pt-1 border-t border-gray-200">
                    <span className={`font-semibold ${profit >= 0 ? "text-green-600" : "text-red-500"}`}>
                      Ganancia: {formatCurrency(profit)}
                    </span>
                    <span className={profit >= 0 ? "text-green-600" : "text-red-500"}>
                      {margin.toFixed(1)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop: Table layout */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2.5 text-gray-400 font-medium">#</th>
                  <th className="text-left py-2.5 text-gray-400 font-medium">Prenda</th>
                  <th className="text-left py-2.5 text-gray-400 font-medium">Talle</th>
                  <th className="text-right py-2.5 text-gray-400 font-medium">Cant.</th>
                  <th className="text-right py-2.5 text-gray-400 font-medium">Materiales</th>
                  <th className="text-right py-2.5 text-gray-400 font-medium">M.O.</th>
                  <th className="text-right py-2.5 text-gray-400 font-medium">Costo</th>
                  <th className="text-right py-2.5 text-gray-400 font-medium">Precio</th>
                  <th className="text-right py-2.5 text-gray-400 font-medium">Ganancia</th>
                  <th className="text-right py-2.5 text-gray-400 font-medium">Margen</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const mc = materialCost(item);
                  const tc = itemTotal(item);
                  const profit = (item.sale_price || 0) - tc;
                  const margin = item.sale_price > 0 ? (profit / item.sale_price * 100) : 0;
                  return (
                    <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="py-3 text-gray-300">{idx + 1}</td>
                      <td className="py-3 font-medium text-gray-900">{item.description}</td>
                      <td className="py-3 text-gray-500">{item.size_color}</td>
                      <td className="py-3 text-right text-gray-700">{item.quantity}</td>
                      <td className="py-3 text-right text-gray-700">{formatCurrency(mc)}</td>
                      <td className="py-3 text-right text-gray-700">{formatCurrency(item.labor_cost)}</td>
                      <td className="py-3 text-right font-medium text-gray-900">{formatCurrency(tc)}</td>
                      <td className="py-3 text-right text-gray-700">{formatCurrency(item.sale_price)}</td>
                      <td className={`py-3 text-right font-medium ${profit >= 0 ? "text-green-600" : "text-red-500"}`}>
                        {formatCurrency(profit)}
                      </td>
                      <td className={`py-3 text-right ${margin >= 0 ? "text-green-600" : "text-red-500"}`}>
                        {margin.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Print Jobs */}
      {prints.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-50 p-5 sm:p-6 mb-4 shadow-sm">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Trabajos de Impresión ({prints.length})</h3>

          {/* Mobile: Card layout */}
          <div className="sm:hidden space-y-3">
            {prints.map((pj, idx) => (
              <div key={pj.id} className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <p className="font-semibold text-gray-900 text-sm">{pj.description}</p>
                  <span className="text-xs text-gray-300">#{idx + 1}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-gray-400">Tinta: </span><span className="font-medium">{formatCurrency(pj.ink_cost)}</span></div>
                  <div><span className="text-gray-400">Papel: </span><span className="font-medium">{formatCurrency(pj.paper_cost)}</span></div>
                  <div><span className="text-gray-400">Yardas: </span><span className="font-medium">{formatCurrency(pj.yard_price * pj.yards_qty)}</span></div>
                  <div><span className="text-gray-400">Diseño: </span><span className="font-medium">{formatCurrency(pj.design_qty * pj.design_unit_price)}</span></div>
                </div>
                <div className="text-xs pt-1 border-t border-gray-200">
                  <span className="text-gray-400">Total: </span>
                  <span className="font-semibold">{formatCurrency(printJobTotal(pj))}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: Table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2.5 text-gray-400 font-medium">#</th>
                  <th className="text-left py-2.5 text-gray-400 font-medium">Descripción</th>
                  <th className="text-right py-2.5 text-gray-400 font-medium">Tinta</th>
                  <th className="text-right py-2.5 text-gray-400 font-medium">Papel</th>
                  <th className="text-right py-2.5 text-gray-400 font-medium">Yardas</th>
                  <th className="text-right py-2.5 text-gray-400 font-medium">Diseño</th>
                  <th className="text-right py-2.5 text-gray-400 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {prints.map((pj, idx) => (
                  <tr key={pj.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-3 text-gray-300">{idx + 1}</td>
                    <td className="py-3 font-medium text-gray-900">{pj.description}</td>
                    <td className="py-3 text-right text-gray-700">{formatCurrency(pj.ink_cost)}</td>
                    <td className="py-3 text-right text-gray-700">{formatCurrency(pj.paper_cost)}</td>
                    <td className="py-3 text-right text-gray-700">{formatCurrency(pj.yard_price * pj.yards_qty)}</td>
                    <td className="py-3 text-right text-gray-700">{formatCurrency(pj.design_qty * pj.design_unit_price)}</td>
                    <td className="py-3 text-right font-medium text-gray-900">{formatCurrency(printJobTotal(pj))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Totals */}
      <div className="bg-brandit-orange rounded-2xl p-5 sm:p-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 text-center">
          <div>
            <p className="text-[11px] text-white/40 uppercase tracking-wider">Costo Confección</p>
            <p className="text-lg sm:text-xl font-bold text-white mt-1">{formatCurrency(totalConfection)}</p>
          </div>
          <div>
            <p className="text-[11px] text-white/40 uppercase tracking-wider">Costo Impresión</p>
            <p className="text-lg sm:text-xl font-bold text-white mt-1">{formatCurrency(totalPrint)}</p>
          </div>
          <div>
            <p className="text-[11px] text-white/40 uppercase tracking-wider">Costo Total</p>
            <p className="text-lg sm:text-xl font-bold text-white mt-1">{formatCurrency(grandCost)}</p>
          </div>
          <div className="border-t sm:border-t-0 sm:border-l border-white/10 pt-4 sm:pt-0 sm:pl-6 col-span-2 sm:col-span-1">
            <p className="text-[11px] text-green-400/70 uppercase tracking-wider font-semibold">Ventas Total</p>
            <p className="text-lg sm:text-xl font-bold text-green-400 mt-1">{formatCurrency(totalSales + totalPrint)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
