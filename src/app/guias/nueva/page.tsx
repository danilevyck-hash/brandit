"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Item = {
  cliente: string;
  direccion: string;
  empresa: string;
  facturas: string;
  bultos: string;
  numero_guia_transp: string;
};

const emptyItem = (): Item => ({
  cliente: "", direccion: "", empresa: "", facturas: "", bultos: "", numero_guia_transp: "",
});

export default function NuevaGuiaPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    fecha: new Date().toISOString().split("T")[0],
    transportista: "",
    placa: "",
    observaciones: "",
  });
  const [items, setItems] = useState<Item[]>([emptyItem()]);

  const addItem = () => setItems([...items, emptyItem()]);
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: keyof Item, value: string) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], [field]: value };
    setItems(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/guias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, items }),
    });
    const data = await res.json();
    if (data.error) {
      alert(data.error);
      setSaving(false);
    } else {
      router.push(`/guias/${data.id}`);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link href="/guias" className="text-sm text-gray-400 hover:text-brandit-black transition-colors">
          ← Guías
        </Link>
      </div>

      <div className="mb-8">
        <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Logística</p>
        <h1 className="text-3xl font-bold text-brandit-black tracking-tight">Nueva guía</h1>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Transport data */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-4">Datos del transporte</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Fecha</label>
              <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} required
                className="w-full border-b border-gray-200 py-2 text-sm outline-none focus:border-brandit-orange transition-colors bg-transparent" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Transportista</label>
              <input placeholder="Nombre del transportista" value={form.transportista} onChange={(e) => setForm({ ...form, transportista: e.target.value })} required
                className="w-full border-b border-gray-200 py-2 text-sm outline-none focus:border-brandit-orange transition-colors bg-transparent" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Placa</label>
              <input placeholder="Placa del vehículo" value={form.placa} onChange={(e) => setForm({ ...form, placa: e.target.value })} required
                className="w-full border-b border-gray-200 py-2 text-sm outline-none focus:border-brandit-orange transition-colors bg-transparent" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Observaciones</label>
              <input placeholder="Opcional" value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                className="w-full border-b border-gray-200 py-2 text-sm outline-none focus:border-brandit-orange transition-colors bg-transparent" />
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs uppercase tracking-widest text-gray-400">Items de entrega</p>
            <button type="button" onClick={addItem} className="text-sm text-brandit-orange font-medium hover:text-brandit-orange/80">
              + Agregar item
            </button>
          </div>

          <div className="space-y-4">
            {items.map((item, idx) => (
              <div key={idx} className="border border-gray-100 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-gray-400">Item {idx + 1}</span>
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeItem(idx)} className="text-xs text-red-400 hover:text-red-600">
                      Quitar
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-x-6 gap-y-3">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Cliente</label>
                    <input value={item.cliente} onChange={(e) => updateItem(idx, "cliente", e.target.value)} required
                      className="w-full border-b border-gray-200 py-1.5 text-sm outline-none focus:border-brandit-orange transition-colors bg-transparent" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Dirección</label>
                    <input value={item.direccion} onChange={(e) => updateItem(idx, "direccion", e.target.value)}
                      className="w-full border-b border-gray-200 py-1.5 text-sm outline-none focus:border-brandit-orange transition-colors bg-transparent" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Empresa</label>
                    <input value={item.empresa} onChange={(e) => updateItem(idx, "empresa", e.target.value)}
                      className="w-full border-b border-gray-200 py-1.5 text-sm outline-none focus:border-brandit-orange transition-colors bg-transparent" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Facturas</label>
                    <input value={item.facturas} onChange={(e) => updateItem(idx, "facturas", e.target.value)}
                      className="w-full border-b border-gray-200 py-1.5 text-sm outline-none focus:border-brandit-orange transition-colors bg-transparent" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Bultos</label>
                    <input type="number" value={item.bultos} onChange={(e) => updateItem(idx, "bultos", e.target.value)} required
                      className="w-full border-b border-gray-200 py-1.5 text-sm outline-none focus:border-brandit-orange transition-colors bg-transparent" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1"># Guía Transporte</label>
                    <input value={item.numero_guia_transp} onChange={(e) => updateItem(idx, "numero_guia_transp", e.target.value)}
                      className="w-full border-b border-gray-200 py-1.5 text-sm outline-none focus:border-brandit-orange transition-colors bg-transparent" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button type="submit" disabled={saving}
          className="bg-brandit-orange text-white rounded-xl px-8 py-2.5 text-sm font-medium hover:bg-brandit-orange/90 transition-colors disabled:opacity-50">
          {saving ? "Guardando..." : "Crear Guía"}
        </button>
      </form>
    </div>
  );
}
