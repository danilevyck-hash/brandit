"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Client } from "@/lib/supabase";
import ClientSelector from "@/components/ClientSelector";
import ConfectionTable, { emptyItem, calcTotalCost } from "@/components/ConfectionTable";
import PrintSection, { emptyPrint, calcPrintTotal } from "@/components/PrintSection";
import type { PrintDraft } from "@/components/PrintSection";
import { formatCurrency } from "@/lib/format";

type ItemDraft = ReturnType<typeof emptyItem>;

export default function NuevaQuotation() {
  const router = useRouter();
  const [client, setClient] = useState<Client | null>(null);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([emptyItem()]);
  const [prints, setPrints] = useState<PrintDraft[]>([]);
  const [saving, setSaving] = useState(false);

  const totalConfection = items.reduce((s, i) => s + calcTotalCost(i), 0);
  const totalPrint = prints.reduce((s, p) => s + calcPrintTotal(p), 0);
  const grandTotal = totalConfection + totalPrint;

  async function save() {
    if (!client) return alert("Selecciona un cliente");
    if (items.length === 0 && prints.length === 0) return alert("Agrega al menos un item o impresión");

    setSaving(true);
    try {
      const qRes = await fetch("/api/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: client.id, date, notes }),
      });
      const quotation = await qRes.json();
      if (quotation.error) throw new Error(quotation.error);

      if (items.length > 0) {
        const itemsToSave = items
          .filter(i => i.description.trim())
          .map(({ _key, ...rest }) => ({ ...rest, quotation_id: quotation.id }));
        if (itemsToSave.length > 0) {
          await fetch("/api/quotation-items", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(itemsToSave),
          });
        }
      }

      if (prints.length > 0) {
        const printsToSave = prints
          .filter(p => p.description.trim())
          .map(({ _key, ...rest }) => ({ ...rest, quotation_id: quotation.id }));
        if (printsToSave.length > 0) {
          await fetch("/api/print-jobs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(printsToSave),
          });
        }
      }

      router.push(`/cotizacion/${quotation.id}`);
    } catch (err: unknown) {
      alert("Error al guardar: " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-brandit-black tracking-tight">Nueva Cotización</h1>
          <p className="text-xs text-gray-400 mt-0.5">Completa los detalles de producción</p>
        </div>
        <button
          onClick={() => router.back()}
          className="text-sm text-gray-400 hover:text-gray-600 transition-colors font-medium"
        >
          ← Volver
        </button>
      </div>

      <div className="space-y-6">
        {/* Client & Date */}
        <div className="bg-white rounded-2xl border border-gray-50 p-6 shadow-sm space-y-5">
          <ClientSelector selectedClientId={client?.id ?? null} onSelect={setClient} />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-brandit-orange/20 focus:border-brandit-orange outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
              <input
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Notas opcionales..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-brandit-orange/20 focus:border-brandit-orange outline-none"
              />
            </div>
          </div>
        </div>

        {/* Confection Items */}
        <div className="bg-gray-50/50 rounded-2xl border border-gray-100 p-6">
          <ConfectionTable items={items} onChange={setItems} />
        </div>

        {/* Print Jobs */}
        <div className="bg-gray-50/50 rounded-2xl border border-gray-100 p-6">
          <PrintSection prints={prints} onChange={setPrints} />
        </div>

        {/* Summary */}
        <div className="bg-brandit-orange rounded-2xl p-6">
          <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-4">Resumen de Costos</h3>
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <p className="text-[10px] text-white/40 uppercase">Confección</p>
              <p className="text-xl font-bold text-white mt-1">{formatCurrency(totalConfection)}</p>
            </div>
            <div>
              <p className="text-[10px] text-white/40 uppercase">Impresión</p>
              <p className="text-xl font-bold text-white mt-1">{formatCurrency(totalPrint)}</p>
            </div>
            <div className="border-l border-white/10 pl-6">
              <p className="text-[10px] text-white/60 uppercase font-semibold">Total</p>
              <p className="text-xl font-bold text-white mt-1">{formatCurrency(grandTotal)}</p>
            </div>
          </div>
        </div>

        {/* Save */}
        <button
          onClick={save}
          disabled={saving}
          className="w-full bg-brandit-orange text-white font-bold py-4 rounded-2xl text-sm hover:bg-brandit-orange/90 transition-colors disabled:opacity-50 shadow-sm"
        >
          {saving ? "Guardando..." : "Guardar Cotización"}
        </button>
      </div>
    </div>
  );
}
