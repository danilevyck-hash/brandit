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
  cliente: "",
  direccion: "",
  empresa: "",
  facturas: "",
  bultos: "",
  numero_guia_transp: "",
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
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/guias" className="text-sm text-gray-400 hover:text-navy">← Guías</Link>
      </div>

      <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-8">Nueva Guía</h1>

      <form onSubmit={handleSubmit}>
        <div className="bg-white rounded-2xl border border-gray-50 p-6 mb-6">
          <h3 className="font-semibold text-navy mb-4">Datos del Transporte</h3>
          <div className="grid grid-cols-2 gap-3">
            <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} required
              className="bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-navy/10 focus:border-navy/30 outline-none" />
            <input placeholder="Transportista" value={form.transportista} onChange={(e) => setForm({ ...form, transportista: e.target.value })} required
              className="bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-navy/10 focus:border-navy/30 outline-none" />
            <input placeholder="Placa" value={form.placa} onChange={(e) => setForm({ ...form, placa: e.target.value })} required
              className="bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-navy/10 focus:border-navy/30 outline-none" />
            <input placeholder="Observaciones (opcional)" value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
              className="bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-navy/10 focus:border-navy/30 outline-none" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-50 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-navy">Items</h3>
            <button type="button" onClick={addItem} className="text-sm text-navy font-semibold hover:text-navy/70">
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
                <div className="grid grid-cols-2 gap-3">
                  <input placeholder="Cliente" value={item.cliente} onChange={(e) => updateItem(idx, "cliente", e.target.value)} required
                    className="bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-navy/10 focus:border-navy/30 outline-none" />
                  <input placeholder="Dirección" value={item.direccion} onChange={(e) => updateItem(idx, "direccion", e.target.value)}
                    className="bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-navy/10 focus:border-navy/30 outline-none" />
                  <input placeholder="Empresa" value={item.empresa} onChange={(e) => updateItem(idx, "empresa", e.target.value)}
                    className="bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-navy/10 focus:border-navy/30 outline-none" />
                  <input placeholder="Facturas" value={item.facturas} onChange={(e) => updateItem(idx, "facturas", e.target.value)}
                    className="bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-navy/10 focus:border-navy/30 outline-none" />
                  <input type="number" placeholder="Bultos" value={item.bultos} onChange={(e) => updateItem(idx, "bultos", e.target.value)} required
                    className="bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-navy/10 focus:border-navy/30 outline-none" />
                  <input placeholder="# Guía Transporte" value={item.numero_guia_transp} onChange={(e) => updateItem(idx, "numero_guia_transp", e.target.value)}
                    className="bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-navy/10 focus:border-navy/30 outline-none" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <button type="submit" disabled={saving}
          className="bg-navy text-white font-semibold px-8 py-3 rounded-xl text-sm hover:bg-navy/90 transition-colors shadow-sm disabled:opacity-50">
          {saving ? "Guardando..." : "Crear Guía"}
        </button>
      </form>
    </div>
  );
}
