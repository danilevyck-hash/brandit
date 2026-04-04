"use client";

import { QuotationItem } from "@/lib/supabase";
import { formatCurrency } from "@/lib/format";

type ItemDraft = Omit<QuotationItem, "id" | "quotation_id" | "created_at"> & { _key: string };

type Props = {
  items: ItemDraft[];
  onChange: (items: ItemDraft[]) => void;
};

function calcMaterialCost(item: ItemDraft): number {
  return (
    item.fabric_qty * item.fabric_price +
    item.lining_qty * item.lining_price +
    item.thread_qty * item.thread_price +
    item.buttons_qty * item.buttons_price +
    item.packaging_qty * item.packaging_price
  );
}

function calcTotalCost(item: ItemDraft): number {
  return calcMaterialCost(item) + item.labor_cost;
}

function calcProfit(item: ItemDraft): number {
  return item.sale_price - calcTotalCost(item);
}

function calcMargin(item: ItemDraft): number {
  if (item.sale_price === 0) return 0;
  return (calcProfit(item) / item.sale_price) * 100;
}

export function emptyItem(): ItemDraft {
  return {
    _key: crypto.randomUUID(),
    description: "",
    size_color: "",
    quantity: 1,
    fabric_qty: 0, fabric_price: 0,
    lining_qty: 0, lining_price: 0,
    thread_qty: 0, thread_price: 0,
    buttons_qty: 0, buttons_price: 0,
    packaging_qty: 0, packaging_price: 0,
    labor_cost: 0,
    seamstress: "",
    sale_price: 0,
  };
}

export { calcMaterialCost, calcTotalCost, calcProfit, calcMargin };

function NumInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      inputMode="decimal"
      step="any"
      value={value || ""}
      onChange={e => onChange(parseFloat(e.target.value) || 0)}
      className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm text-center focus:ring-1 focus:ring-brandit-orange/20 focus:border-brandit-orange outline-none min-h-[44px]"
    />
  );
}

export default function ConfectionTable({ items, onChange }: Props) {
  function update(idx: number, field: keyof ItemDraft, value: unknown) {
    const next = [...items];
    next[idx] = { ...next[idx], [field]: value };
    onChange(next);
  }

  function remove(idx: number) {
    onChange(items.filter((_, i) => i !== idx));
  }

  function add() {
    onChange([...items, emptyItem()]);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Items de Confección</h3>
        <button type="button" onClick={add} className="text-sm bg-brandit-orange text-white px-4 py-2 rounded-xl font-medium hover:bg-brandit-orange/90 transition-colors min-h-[44px] active:scale-[0.98]">
          + Agregar Item
        </button>
      </div>

      {items.length === 0 && (
        <p className="text-gray-400 text-sm text-center py-8 bg-white rounded-xl border border-dashed border-gray-200">
          No hay items. Haz clic en &quot;+ Agregar Item&quot; para comenzar.
        </p>
      )}

      {items.map((item, idx) => (
        <div key={item._key} className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-brandit-black bg-brandit-orange/5 px-2.5 py-1 rounded-lg">#{idx + 1}</span>
            <button type="button" onClick={() => remove(idx)} className="text-red-400 hover:text-red-600 text-sm font-medium min-h-[44px] px-3">Eliminar</button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="col-span-2">
              <label className="text-[10px] text-gray-400 uppercase tracking-wider">Prenda</label>
              <input
                value={item.description}
                onChange={e => update(idx, "description", e.target.value)}
                placeholder="Ej: Pantalón Dama"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-brandit-orange/20 focus:border-brandit-orange outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 uppercase tracking-wider">Talle / Color</label>
              <input
                value={item.size_color || ""}
                onChange={e => update(idx, "size_color", e.target.value)}
                placeholder="Ej: Gris 12"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-brandit-orange/20 focus:border-brandit-orange outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 uppercase tracking-wider">Cantidad</label>
              <NumInput value={item.quantity} onChange={v => update(idx, "quantity", v)} />
            </div>
          </div>

          {/* Materiales */}
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2 font-medium">Materiales (cantidad x precio unitario)</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {([
                ["Tela", "fabric"],
                ["Forro", "lining"],
                ["Hilo/Cierre", "thread"],
                ["Botones/Avíos", "buttons"],
                ["Empaque", "packaging"],
              ] as const).map(([label, key]) => (
                <div key={key} className="bg-amber-50/50 rounded-xl p-2.5 border border-amber-100/50">
                  <p className="text-[10px] text-amber-700/70 font-medium mb-1.5">{label}</p>
                  <div className="flex gap-1">
                    <NumInput value={item[`${key}_qty` as keyof ItemDraft] as number} onChange={v => update(idx, `${key}_qty` as keyof ItemDraft, v)} />
                    <NumInput value={item[`${key}_price` as keyof ItemDraft] as number} onChange={v => update(idx, `${key}_price` as keyof ItemDraft, v)} />
                  </div>
                  <div className="flex gap-1 mt-0.5">
                    <span className="text-[9px] text-gray-400 flex-1 text-center">Cant.</span>
                    <span className="text-[9px] text-gray-400 flex-1 text-center">$/u</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mano de obra + Precio venta */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] text-gray-400 uppercase tracking-wider">Mano de Obra ($)</label>
              <NumInput value={item.labor_cost} onChange={v => update(idx, "labor_cost", v)} />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 uppercase tracking-wider">Confeccionista</label>
              <input
                value={item.seamstress || ""}
                onChange={e => update(idx, "seamstress", e.target.value)}
                placeholder="Nombre"
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-brandit-orange/20 focus:border-brandit-orange outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 uppercase tracking-wider">Precio de Venta ($)</label>
              <NumInput value={item.sale_price} onChange={v => update(idx, "sale_price", v)} />
            </div>
          </div>

          {/* Resumen calculado */}
          <div className="grid grid-cols-4 gap-3 bg-gray-50 rounded-xl p-3">
            <div className="text-center">
              <p className="text-[10px] text-gray-400">Materiales</p>
              <p className="text-xs font-semibold text-gray-900">{formatCurrency(calcMaterialCost(item))}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-gray-400">Costo Total</p>
              <p className="text-xs font-semibold text-gray-900">{formatCurrency(calcTotalCost(item))}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-gray-400">Ganancia</p>
              <p className={`text-xs font-semibold ${calcProfit(item) >= 0 ? "text-green-600" : "text-red-500"}`}>
                {formatCurrency(calcProfit(item))}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-gray-400">Margen</p>
              <p className={`text-xs font-semibold ${calcMargin(item) >= 0 ? "text-green-600" : "text-red-500"}`}>
                {calcMargin(item).toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
