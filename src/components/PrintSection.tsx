"use client";

import { formatCurrency } from "@/lib/format";

export type PrintDraft = {
  _key: string;
  description: string;
  ink_cost: number;
  paper_cost: number;
  yard_price: number;
  yards_qty: number;
  design_size: string;
  design_qty: number;
  design_unit_price: number;
  notes: string;
};

export function emptyPrint(): PrintDraft {
  return {
    _key: crypto.randomUUID(),
    description: "",
    ink_cost: 0,
    paper_cost: 0,
    yard_price: 0,
    yards_qty: 0,
    design_size: "",
    design_qty: 1,
    design_unit_price: 0,
    notes: "",
  };
}

export function calcPrintMaterialCost(p: PrintDraft): number {
  return p.ink_cost + p.paper_cost + p.yard_price * p.yards_qty;
}

export function calcPrintDesignCost(p: PrintDraft): number {
  return p.design_qty * p.design_unit_price;
}

export function calcPrintTotal(p: PrintDraft): number {
  return calcPrintMaterialCost(p) + calcPrintDesignCost(p);
}

type Props = {
  prints: PrintDraft[];
  onChange: (prints: PrintDraft[]) => void;
};

function NumInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      step="any"
      value={value || ""}
      onChange={e => onChange(parseFloat(e.target.value) || 0)}
      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-center focus:ring-1 focus:ring-navy/20 focus:border-navy outline-none"
    />
  );
}

export default function PrintSection({ prints, onChange }: Props) {
  function update(idx: number, field: keyof PrintDraft, value: unknown) {
    const next = [...prints];
    next[idx] = { ...next[idx], [field]: value };
    onChange(next);
  }

  function remove(idx: number) {
    onChange(prints.filter((_, i) => i !== idx));
  }

  function add() {
    onChange([...prints, emptyPrint()]);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Trabajos de Impresión</h3>
        <button type="button" onClick={add} className="text-xs bg-navy text-white px-3 py-1.5 rounded-lg font-medium hover:bg-navy/90 transition-colors">
          + Agregar Impresión
        </button>
      </div>

      {prints.length === 0 && (
        <p className="text-gray-400 text-sm text-center py-8 bg-white rounded-xl border border-dashed border-gray-200">
          No hay impresiones agregadas.
        </p>
      )}

      {prints.map((p, idx) => (
        <div key={p._key} className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-navy bg-navy/5 px-2.5 py-1 rounded-lg">Impresión #{idx + 1}</span>
            <button type="button" onClick={() => remove(idx)} className="text-red-400 hover:text-red-600 text-xs font-medium">Eliminar</button>
          </div>

          <div>
            <label className="text-[10px] text-gray-400 uppercase tracking-wider">Descripción</label>
            <input
              value={p.description}
              onChange={e => update(idx, "description", e.target.value)}
              placeholder="Ej: Sublimación camisetas"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-navy/20 focus:border-navy outline-none"
            />
          </div>

          {/* Sección 1: Materiales */}
          <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100/50">
            <p className="text-[10px] text-blue-600 uppercase tracking-wider font-semibold mb-3">Materiales de Impresión</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] text-gray-500">Costo Tinta ($)</label>
                <NumInput value={p.ink_cost} onChange={v => update(idx, "ink_cost", v)} />
              </div>
              <div>
                <label className="text-[10px] text-gray-500">Costo Papel ($)</label>
                <NumInput value={p.paper_cost} onChange={v => update(idx, "paper_cost", v)} />
              </div>
              <div>
                <label className="text-[10px] text-gray-500">Precio/Yarda ($)</label>
                <NumInput value={p.yard_price} onChange={v => update(idx, "yard_price", v)} />
              </div>
              <div>
                <label className="text-[10px] text-gray-500">Cant. Yardas</label>
                <NumInput value={p.yards_qty} onChange={v => update(idx, "yards_qty", v)} />
              </div>
            </div>
            <p className="text-[10px] text-blue-500 mt-2 font-medium">Subtotal: {formatCurrency(calcPrintMaterialCost(p))}</p>
          </div>

          {/* Sección 2: Diseño */}
          <div className="bg-purple-50/50 rounded-xl p-4 border border-purple-100/50">
            <p className="text-[10px] text-purple-600 uppercase tracking-wider font-semibold mb-3">Costo de Diseño</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] text-gray-500">Tamaño</label>
                <input
                  value={p.design_size}
                  onChange={e => update(idx, "design_size", e.target.value)}
                  placeholder="Ej: 30x40cm"
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-navy/20 focus:border-navy outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500">Cantidad</label>
                <NumInput value={p.design_qty} onChange={v => update(idx, "design_qty", v)} />
              </div>
              <div>
                <label className="text-[10px] text-gray-500">Precio/Unidad ($)</label>
                <NumInput value={p.design_unit_price} onChange={v => update(idx, "design_unit_price", v)} />
              </div>
            </div>
            <p className="text-[10px] text-purple-500 mt-2 font-medium">Subtotal: {formatCurrency(calcPrintDesignCost(p))}</p>
          </div>

          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-[10px] text-gray-400">Total Impresión</p>
            <p className="text-sm font-bold text-gray-900">{formatCurrency(calcPrintTotal(p))}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
