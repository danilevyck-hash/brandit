"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";

type Item = {
  marca: string;
  descripcion: string;
  color: string;
  talla: string;
  cantidad: number;
};

const EMPTY_ITEM: Item = { marca: "", descripcion: "", color: "", talla: "", cantidad: 1 };

const LS_KEY = "brandit_ne_draft";

export default function NuevaNotaPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [cliente, setCliente] = useState("");
  const [atencion, setAtencion] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [items, setItems] = useState<Item[]>([{ ...EMPTY_ITEM }]);
  const [saving, setSaving] = useState(false);
  const autoSaveRef = useRef<ReturnType<typeof setInterval>>();

  // Load draft from localStorage
  useEffect(() => {
    try {
      const draft = localStorage.getItem(LS_KEY);
      if (draft) {
        const d = JSON.parse(draft);
        if (d.cliente) setCliente(d.cliente);
        if (d.atencion) setAtencion(d.atencion);
        if (d.fecha) setFecha(d.fecha);
        if (d.items?.length) setItems(d.items);
      }
    } catch { /* ignore */ }
  }, []);

  // Auto-save draft every 5s
  useEffect(() => {
    autoSaveRef.current = setInterval(() => {
      const draft = { cliente, atencion, fecha, items };
      localStorage.setItem(LS_KEY, JSON.stringify(draft));
    }, 5000);
    return () => clearInterval(autoSaveRef.current);
  }, [cliente, atencion, fecha, items]);

  const updateItem = (idx: number, field: keyof Item, value: string | number) => {
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  };

  const addItem = () => {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  };

  const removeItem = (idx: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const totalCantidad = items.reduce((sum, i) => sum + (Number(i.cantidad) || 0), 0);

  const handleSave = async () => {
    if (!cliente.trim()) {
      toast("Ingresa el nombre del cliente", "error");
      return;
    }
    const validItems = items.filter((i) => i.descripcion.trim());
    if (validItems.length === 0) {
      toast("Agrega al menos un item con descripcion", "error");
      return;
    }

    setSaving(true);
    try {
      const nombre = localStorage.getItem("brandit_nombre") || "";
      const res = await fetch("/api/notas-entrega", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente: cliente.trim(),
          atencion: atencion.trim() || null,
          fecha,
          items: validItems,
          created_by: nombre,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al guardar");
      }

      const nota = await res.json();
      localStorage.removeItem(LS_KEY);
      toast("Nota de entrega creada");
      router.push(`/notas-entrega/${nota.id}`);
    } catch (e) {
      toast((e as Error).message, "error");
    }
    setSaving(false);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.push("/notas-entrega")}
          className="text-sm text-gray-400 hover:text-brandit-orange transition-colors mb-3 flex items-center gap-1"
        >
          &#8592; Notas de Entrega
        </button>
        <h1 className="text-3xl font-bold text-brandit-black tracking-tight">Nueva Nota de Entrega</h1>
      </div>

      {/* Form */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 sm:p-8 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-xs uppercase tracking-widest text-gray-400 mb-2">Cliente *</label>
            <input
              type="text"
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              placeholder="Nombre del cliente"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brandit-orange transition-colors min-h-[44px]"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-gray-400 mb-2">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brandit-orange transition-colors min-h-[44px]"
            />
          </div>
        </div>
        <div className="mb-6">
          <label className="block text-xs uppercase tracking-widest text-gray-400 mb-2">Nota al cliente</label>
          <textarea
            value={atencion}
            onChange={(e) => setAtencion(e.target.value)}
            placeholder="Mensaje o nota para el cliente (opcional)"
            rows={2}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brandit-orange transition-colors resize-none"
          />
        </div>
      </div>

      {/* Items */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-brandit-black">Items</h2>
          <button
            onClick={addItem}
            className="text-sm font-medium text-brandit-orange hover:underline min-h-[44px] flex items-center"
          >
            + Agregar item
          </button>
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-3 py-2 text-[10px] uppercase tracking-widest text-gray-400 font-medium">Marca</th>
                <th className="text-left px-3 py-2 text-[10px] uppercase tracking-widest text-gray-400 font-medium">Descripcion *</th>
                <th className="text-left px-3 py-2 text-[10px] uppercase tracking-widest text-gray-400 font-medium">Color</th>
                <th className="text-left px-3 py-2 text-[10px] uppercase tracking-widest text-gray-400 font-medium">Talla</th>
                <th className="text-left px-3 py-2 text-[10px] uppercase tracking-widest text-gray-400 font-medium w-20">Cant.</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} className="border-b border-gray-50">
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={item.marca}
                      onChange={(e) => updateItem(idx, "marca", e.target.value)}
                      placeholder="Marca"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brandit-orange transition-colors"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={item.descripcion}
                      onChange={(e) => updateItem(idx, "descripcion", e.target.value)}
                      placeholder="Descripcion del item"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brandit-orange transition-colors"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={item.color}
                      onChange={(e) => updateItem(idx, "color", e.target.value)}
                      placeholder="Color"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brandit-orange transition-colors"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={item.talla}
                      onChange={(e) => updateItem(idx, "talla", e.target.value)}
                      placeholder="Talla"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brandit-orange transition-colors"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={item.cantidad}
                      onChange={(e) => updateItem(idx, "cantidad", Number(e.target.value))}
                      min={1}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brandit-orange transition-colors text-center"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => removeItem(idx)}
                      disabled={items.length <= 1}
                      className="text-gray-300 hover:text-red-500 transition-colors disabled:opacity-30 min-h-[44px] flex items-center justify-center"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="sm:hidden space-y-4">
          {items.map((item, idx) => (
            <div key={idx} className="border border-gray-100 rounded-xl p-4 relative">
              {items.length > 1 && (
                <button
                  onClick={() => removeItem(idx)}
                  className="absolute top-3 right-3 text-gray-300 hover:text-red-500 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase text-gray-400 mb-1">Marca</label>
                  <input
                    type="text"
                    value={item.marca}
                    onChange={(e) => updateItem(idx, "marca", e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brandit-orange transition-colors min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-gray-400 mb-1">Color</label>
                  <input
                    type="text"
                    value={item.color}
                    onChange={(e) => updateItem(idx, "color", e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brandit-orange transition-colors min-h-[44px]"
                  />
                </div>
              </div>
              <div className="mt-3">
                <label className="block text-[10px] uppercase text-gray-400 mb-1">Descripcion *</label>
                <input
                  type="text"
                  value={item.descripcion}
                  onChange={(e) => updateItem(idx, "descripcion", e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brandit-orange transition-colors min-h-[44px]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="block text-[10px] uppercase text-gray-400 mb-1">Talla</label>
                  <input
                    type="text"
                    value={item.talla}
                    onChange={(e) => updateItem(idx, "talla", e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brandit-orange transition-colors min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-gray-400 mb-1">Cantidad</label>
                  <input
                    type="number"
                    value={item.cantidad}
                    onChange={(e) => updateItem(idx, "cantidad", Number(e.target.value))}
                    min={1}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brandit-orange transition-colors text-center min-h-[44px]"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Total and actions */}
        <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-100">
          <div className="text-sm text-gray-500">
            Total cantidad: <span className="font-bold text-brandit-black">{totalCantidad}</span>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-brandit-orange text-white rounded-xl px-8 py-3 text-sm font-medium hover:bg-brandit-orange/90 transition-colors disabled:opacity-50 min-h-[44px]"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
