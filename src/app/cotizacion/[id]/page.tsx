"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Quotation, QuotationItem, PrintJob, QUOTATION_STATUSES } from "@/lib/supabase";
import { formatDate, formatCurrency } from "@/lib/format";
import { generatePDF } from "@/components/QuotationPDF";

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
  const [q, setQ] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/quotations?id=${params.id}`);
    const data = await res.json();
    if (data.error) {
      alert("Cotización no encontrada");
      router.push("/");
      return;
    }
    setQ(data);
    setLoading(false);
  }, [params.id, router]);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(status: string) {
    await fetch("/api/quotations", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: q!.id, status }),
    });
    load();
  }

  async function deleteQuotation() {
    if (!confirm("¿Estás seguro de eliminar esta cotización?")) return;
    await fetch("/api/quotations", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: q!.id }),
    });
    router.push("/");
  }

  if (loading || !q) return <div className="text-center py-24 text-gray-300 text-lg">Cargando...</div>;

  const items = q.items || [];
  const prints = q.print_jobs || [];
  const totalConfection = items.reduce((s, i) => s + itemTotal(i), 0);
  const totalPrint = prints.reduce((s, p) => s + printJobTotal(p), 0);
  const totalSales = items.reduce((s, i) => s + (i.sale_price || 0), 0);
  const grandCost = totalConfection + totalPrint;
  const si = QUOTATION_STATUSES.find(s => s.value === q.status);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-brandit-black tracking-tight">Cotización #{q.id}</h1>
            <span
              className="text-[10px] font-semibold px-3 py-1 rounded-full"
              style={{ backgroundColor: si?.color + "15", color: si?.color }}
            >
              {si?.label}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">{formatDate(q.date)}</p>
        </div>
        <button onClick={() => router.push("/")} className="text-sm text-gray-400 hover:text-gray-600 font-medium">← Volver</button>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 mb-6">
        {QUOTATION_STATUSES.map(s => (
          <button
            key={s.value}
            onClick={() => updateStatus(s.value)}
            disabled={q.status === s.value}
            className="text-xs px-3 py-1.5 rounded-xl border-2 font-medium transition-all disabled:opacity-30"
            style={{
              borderColor: s.color,
              color: q.status === s.value ? "white" : s.color,
              backgroundColor: q.status === s.value ? s.color : "transparent",
            }}
          >
            {s.label}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={() => generatePDF(q)}
          className="text-xs bg-brandit-orange text-white px-5 py-1.5 rounded-xl font-medium hover:bg-brandit-orange/90 transition-colors"
        >
          Descargar PDF
        </button>
        <button
          onClick={deleteQuotation}
          className="text-xs text-red-400 hover:text-red-600 px-4 py-1.5 rounded-xl border border-red-100 hover:border-red-300 transition-colors font-medium"
        >
          Eliminar
        </button>
      </div>

      {/* Client info */}
      <div className="bg-white rounded-2xl border border-gray-50 p-6 mb-4 shadow-sm">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">Cliente</p>
            <p className="text-sm font-semibold text-gray-900 mt-0.5">{q.client?.name || "Sin cliente"}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">Fecha</p>
            <p className="text-sm text-gray-700 mt-0.5">{formatDate(q.date)}</p>
          </div>
          {q.client?.phone && (
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Teléfono</p>
              <p className="text-sm text-gray-700 mt-0.5">{q.client.phone}</p>
            </div>
          )}
          {q.notes && (
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Notas</p>
              <p className="text-sm text-gray-700 mt-0.5">{q.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Confection Items */}
      {items.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-50 p-6 mb-4 shadow-sm">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Items de Confección ({items.length})</h3>
          <div className="overflow-x-auto">
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
        <div className="bg-white rounded-2xl border border-gray-50 p-6 mb-4 shadow-sm">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Trabajos de Impresión ({prints.length})</h3>
          <div className="overflow-x-auto">
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
      <div className="bg-brandit-orange rounded-2xl p-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          <div>
            <p className="text-[10px] text-white/40 uppercase tracking-wider">Costo Confección</p>
            <p className="text-xl font-bold text-white mt-1">{formatCurrency(totalConfection)}</p>
          </div>
          <div>
            <p className="text-[10px] text-white/40 uppercase tracking-wider">Costo Impresión</p>
            <p className="text-xl font-bold text-white mt-1">{formatCurrency(totalPrint)}</p>
          </div>
          <div>
            <p className="text-[10px] text-white/40 uppercase tracking-wider">Costo Total</p>
            <p className="text-xl font-bold text-white mt-1">{formatCurrency(grandCost)}</p>
          </div>
          <div className="border-l border-white/10 pl-6">
            <p className="text-[10px] text-green-400/70 uppercase tracking-wider font-semibold">Ventas Total</p>
            <p className="text-xl font-bold text-green-400 mt-1">{formatCurrency(totalSales + totalPrint)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
