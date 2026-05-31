"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Transportista, GuiaItem } from "./types";

const DRAFT_KEY = "guia_draft_v1";
const emptyItem = (): GuiaItem => ({ cliente: "", direccion: "", facturas: "", bultos: 0, numero_guia_transp: "" });

export default function GuiaForm() {
  const router = useRouter();
  const hoy = new Date().toISOString().slice(0, 10);
  const [fecha, setFecha] = useState(hoy);
  const [modoEntrega, setModoEntrega] = useState<"transportista" | "entrega_directa">("entrega_directa");
  const [transportista, setTransportista] = useState(""); // texto libre (autocompleta con catálogo)
  const [placa, setPlaca] = useState("");
  const [entregadoPor, setEntregadoPor] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [items, setItems] = useState<GuiaItem[]>([emptyItem()]);
  const [transportistas, setTransportistas] = useState<Transportista[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Cargar transportistas + draft.
  useEffect(() => {
    fetch("/api/guias/transportistas").then((r) => (r.ok ? r.json() : [])).then((d) => setTransportistas(Array.isArray(d) ? d : [])).catch(() => {});
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.fecha) setFecha(d.fecha);
        if (d.modoEntrega) setModoEntrega(d.modoEntrega);
        if (d.transportista) setTransportista(d.transportista);
        if (d.placa) setPlaca(d.placa);
        if (d.entregadoPor) setEntregadoPor(d.entregadoPor);
        if (d.observaciones) setObservaciones(d.observaciones);
        if (Array.isArray(d.items) && d.items.length) setItems(d.items);
      }
    } catch { /* ignore */ }
    setLoaded(true);
  }, []);

  // Auto-save draft.
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ fecha, modoEntrega, transportista, placa, entregadoPor, observaciones, items }));
    } catch { /* ignore */ }
  }, [loaded, fecha, modoEntrega, transportista, placa, entregadoPor, observaciones, items]);

  const setItem = (i: number, patch: Partial<GuiaItem>) => setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const addItem = () => setItems((prev) => [...prev, emptyItem()]);
  const removeItem = (i: number) => setItems((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));

  const totalBultos = items.reduce((s, i) => s + (Number(i.bultos) || 0), 0);

  const submit = async () => {
    setError(null);
    if (modoEntrega === "transportista" && !transportista.trim()) { setError("Indica el transportista"); return; }
    if (totalBultos === 0) { setError("La guía debe tener al menos un item con bultos > 0"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/guias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha, modo_entrega: modoEntrega,
          transportista: modoEntrega === "transportista" ? transportista.trim() : null,
          transportista_id: modoEntrega === "transportista"
            ? (transportistas.find((t) => t.nombre.trim().toLowerCase() === transportista.trim().toLowerCase())?.id ?? null)
            : null,
          placa: placa || null, entregado_por: entregadoPor || null, observaciones: observaciones || null,
          items: items.map((i) => ({ ...i, bultos: Number(i.bultos) || 0 })),
        }),
      });
      const d = await res.json();
      if (!res.ok || d.error) throw new Error(d.error || `HTTP ${res.status}`);
      localStorage.removeItem(DRAFT_KEY);
      router.push(`/guias/${d.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al crear");
      setSaving(false);
    }
  };

  const input = "w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-brandit-orange/20 outline-none";

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push("/guias")} className="text-gray-400 hover:text-brandit-black text-sm">← Guías</button>
        <h1 className="text-3xl font-extrabold text-brandit-black dark:text-white tracking-tight">Nueva guía</h1>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block"><span className="text-xs font-medium text-gray-500">Fecha</span><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={input} /></label>
          <label className="block"><span className="text-xs font-medium text-gray-500">Despachado por</span><input value={entregadoPor} onChange={(e) => setEntregadoPor(e.target.value)} placeholder="Nombre" className={input} /></label>
        </div>

        <div>
          <span className="text-xs font-medium text-gray-500">Modo de entrega</span>
          <div className="flex gap-2 mt-1">
            {(["entrega_directa", "transportista"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setModoEntrega(m)}
                className={`px-4 py-2 rounded-xl text-sm font-medium ${modoEntrega === m ? "bg-brandit-orange text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-500"}`}>
                {m === "entrega_directa" ? "Entrega directa" : "Transportista"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {modoEntrega === "transportista" && (
            <label className="block"><span className="text-xs font-medium text-gray-500">Transportista</span>
              <input list="transportistas-dl" value={transportista} onChange={(e) => setTransportista(e.target.value)} placeholder="Nombre del transportista" className={input} />
              <datalist id="transportistas-dl">{transportistas.map((t) => <option key={t.id} value={t.nombre} />)}</datalist>
              <span className="text-[11px] text-gray-400">Escribí uno nuevo o elegí del autocompletado.</span>
            </label>
          )}
          <label className="block"><span className="text-xs font-medium text-gray-500">Placa / vehículo</span><input value={placa} onChange={(e) => setPlaca(e.target.value)} className={input} /></label>
        </div>

        <label className="block"><span className="text-xs font-medium text-gray-500">Observaciones</span><textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2} className={input} /></label>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 shadow-sm mt-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-brandit-black dark:text-white">Items ({totalBultos} bultos)</h2>
          <button onClick={addItem} className="text-xs font-medium text-brandit-orange">+ Agregar item</button>
        </div>
        <div className="space-y-3">
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-start">
              <input value={it.cliente} onChange={(e) => setItem(i, { cliente: e.target.value })} placeholder="Cliente" className={`${input} col-span-3`} />
              <input value={it.direccion} onChange={(e) => setItem(i, { direccion: e.target.value })} placeholder="Dirección" className={`${input} col-span-3`} />
              <input value={it.facturas} onChange={(e) => setItem(i, { facturas: e.target.value })} placeholder="Factura(s)" className={`${input} col-span-2`} />
              <input type="number" min={0} value={it.bultos || ""} onChange={(e) => setItem(i, { bultos: Number(e.target.value) })} placeholder="Bultos" className={`${input} col-span-2`} />
              <input value={it.numero_guia_transp} onChange={(e) => setItem(i, { numero_guia_transp: e.target.value })} placeholder="N° guía" className={`${input} col-span-1`} />
              <button onClick={() => removeItem(i)} className="col-span-1 text-gray-300 hover:text-red-500 py-2.5">✕</button>
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-red-500 text-sm mt-4">{error}</p>}
      <div className="flex justify-end gap-2 mt-4">
        <button onClick={submit} disabled={saving} className="bg-brandit-orange text-white font-semibold px-6 py-3 rounded-xl text-sm hover:bg-brandit-orange/90 disabled:opacity-50 min-h-[44px]">
          {saving ? "Creando…" : "Crear guía"}
        </button>
      </div>
      <p className="text-xs text-gray-400 mt-2 text-right">Borrador guardado automáticamente.</p>
    </div>
  );
}
