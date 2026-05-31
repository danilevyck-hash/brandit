"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Guia } from "./types";
import { fmtGuia, fmtFechaCorta } from "./types";
import SignatureCanvas from "./SignatureCanvas";
import PrintDocument from "./PrintDocument";

const BADGE: Record<string, string> = {
  "Pendiente Bodega": "bg-amber-50 text-amber-700",
  "Completada": "bg-green-50 text-green-700",
  "Despachada": "bg-green-50 text-green-700",
  "Rechazada": "bg-red-50 text-red-700",
};

export default function GuiaDetail({ id }: { id: string }) {
  const router = useRouter();
  const [g, setG] = useState<Guia | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Estado del form de despacho
  const [tipoDespacho, setTipoDespacho] = useState<"externo" | "directo">("externo");
  const [entregadoPor, setEntregadoPor] = useState("");
  const [nombreChofer, setNombreChofer] = useState("");
  const [placa, setPlaca] = useState("");
  const [numGuiaTransp, setNumGuiaTransp] = useState("");
  const [receptor, setReceptor] = useState("");
  const [cedula, setCedula] = useState("");
  const [firmaDespacho, setFirmaDespacho] = useState<string | null>(null);
  const [firmaReceptor, setFirmaReceptor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  const load = () => fetch(`/api/guias/${id}`).then(async (r) => {
    const d = await r.json(); if (!r.ok || d.error) throw new Error(d.error || `HTTP ${r.status}`);
    setG(d as Guia);
    setEntregadoPor(d.entregado_por || "");
    setPlaca(d.placa || "");
  }).catch((e) => setError(e instanceof Error ? e.message : "Error"));

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  if (error) return <div className="max-w-4xl mx-auto px-4 py-8"><div className="bg-red-50 border border-red-100 rounded-lg px-6 py-6 text-sm text-red-700">Error: {error}</div></div>;
  if (!g) return <div className="max-w-4xl mx-auto px-4 py-8 text-gray-400 text-sm">Cargando…</div>;

  const pendiente = g.estado === "Pendiente Bodega";
  const items = g.guia_items || [];
  const bultos = items.reduce((s, i) => s + (i.bultos || 0), 0);

  const despachar = async () => {
    setFormErr(null);
    if (!receptor) { setFormErr("Nombre del receptor requerido"); return; }
    if (!cedula) { setFormErr("Cédula del receptor requerida"); return; }
    if (tipoDespacho === "externo" && !placa) { setFormErr("Placa requerida para transporte externo"); return; }
    if (tipoDespacho === "directo" && !nombreChofer) { setFormErr("Nombre del chofer requerido"); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/guias/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estado: "Completada", tipo_despacho: tipoDespacho,
          receptor_nombre: receptor, cedula, placa: placa || null,
          nombre_chofer: tipoDespacho === "directo" ? nombreChofer : null,
          entregado_por: entregadoPor || null, numero_guia_transp: numGuiaTransp || null,
          firma_base64: firmaDespacho, firma_entregador_base64: firmaReceptor,
        }),
      });
      const d = await res.json();
      if (!res.ok || d.error) throw new Error(d.error || `HTTP ${res.status}`);
      await load();
    } catch (e) { setFormErr(e instanceof Error ? e.message : "Error al despachar"); }
    finally { setBusy(false); }
  };

  const rechazar = async () => {
    const motivo = window.prompt("Motivo del rechazo:");
    if (motivo == null) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/guias/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ estado: "Rechazada", motivo_rechazo: motivo }) });
      const d = await res.json(); if (!res.ok || d.error) throw new Error(d.error || `HTTP ${res.status}`);
      await load();
    } catch (e) { setFormErr(e instanceof Error ? e.message : "Error"); } finally { setBusy(false); }
  };

  const eliminar = async () => {
    if (!window.confirm("¿Eliminar esta guía?")) return;
    const res = await fetch(`/api/guias/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/guias");
    else { const d = await res.json(); setFormErr(d.error || "No se pudo eliminar"); }
  };

  const input = "w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-brandit-orange/20 outline-none";

  return (
    <>
      <div className="print:hidden max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/guias")} className="text-gray-400 hover:text-brandit-black text-sm">← Guías</button>
            <h1 className="text-3xl font-extrabold text-brandit-black dark:text-white tracking-tight">Guía {fmtGuia(g.numero)}</h1>
            <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-medium ${BADGE[g.estado] ?? "bg-gray-100 text-gray-600"}`}>{g.estado}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="bg-white border border-gray-200 text-brandit-black font-semibold px-4 py-2.5 rounded-xl text-sm hover:bg-gray-50">Imprimir</button>
            <button onClick={eliminar} className="text-gray-400 hover:text-red-500 text-sm px-2">Eliminar</button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 shadow-sm mb-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <Info label="Fecha" value={fmtFechaCorta(g.fecha)} />
          <Info label="Transportista" value={g.transportista || "—"} />
          <Info label="Placa" value={g.placa || "—"} />
          <Info label="Despachado por" value={g.entregado_por || "—"} />
          <Info label="Total bultos" value={String(bultos)} />
          <Info label="Monto" value={g.monto_total ? `$${Number(g.monto_total).toFixed(2)}` : "—"} />
          {g.estado === "Rechazada" && g.motivo_rechazo && <Info label="Motivo rechazo" value={g.motivo_rechazo} />}
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-x-auto mb-4">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100 dark:border-gray-800 text-xs font-semibold text-gray-500">
              <th className="px-4 py-2.5 text-left">#</th><th className="px-3 py-2.5 text-left">Cliente</th><th className="px-3 py-2.5 text-left">Dirección</th><th className="px-3 py-2.5 text-left">Facturas</th><th className="px-3 py-2.5 text-right">Bultos</th>
            </tr></thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className="border-b border-gray-50 dark:border-gray-800/50">
                  <td className="px-4 py-2 text-gray-400">{i + 1}</td><td className="px-3 py-2 text-gray-900 dark:text-gray-100">{it.cliente}</td>
                  <td className="px-3 py-2 text-gray-600">{it.direccion}</td><td className="px-3 py-2 text-gray-600">{it.facturas}</td>
                  <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{it.bultos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {g.observaciones && <p className="text-sm text-gray-500 mb-4"><span className="font-medium">Observaciones:</span> {g.observaciones}</p>}

        {pendiente && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-brandit-black dark:text-white mb-4">Despachar</h2>
            <div className="flex gap-2 mb-4">
              {(["externo", "directo"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setTipoDespacho(t)} className={`px-4 py-2 rounded-xl text-sm font-medium ${tipoDespacho === t ? "bg-brandit-orange text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-500"}`}>
                  {t === "externo" ? "Transporte externo" : "Entrega directa"}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {tipoDespacho === "externo" ? (
                <>
                  <label className="block"><span className="text-xs font-medium text-gray-500">Placa</span><input value={placa} onChange={(e) => setPlaca(e.target.value)} className={input} /></label>
                  <label className="block"><span className="text-xs font-medium text-gray-500">N° guía transportista</span><input value={numGuiaTransp} onChange={(e) => setNumGuiaTransp(e.target.value)} className={input} /></label>
                </>
              ) : (
                <label className="block"><span className="text-xs font-medium text-gray-500">Nombre del chofer</span><input value={nombreChofer} onChange={(e) => setNombreChofer(e.target.value)} className={input} /></label>
              )}
              <label className="block"><span className="text-xs font-medium text-gray-500">Despachado por</span><input value={entregadoPor} onChange={(e) => setEntregadoPor(e.target.value)} className={input} /></label>
              <label className="block"><span className="text-xs font-medium text-gray-500">Receptor (nombre)</span><input value={receptor} onChange={(e) => setReceptor(e.target.value)} className={input} /></label>
              <label className="block"><span className="text-xs font-medium text-gray-500">Cédula receptor</span><input value={cedula} onChange={(e) => setCedula(e.target.value)} className={input} /></label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div><span className="text-xs font-medium text-gray-500">Firma de quien despacha</span><SignatureCanvas value={firmaDespacho} onChange={setFirmaDespacho} /></div>
              <div><span className="text-xs font-medium text-gray-500">Firma del receptor</span><SignatureCanvas value={firmaReceptor} onChange={setFirmaReceptor} /></div>
            </div>
            {formErr && <p className="text-red-500 text-sm mt-3">{formErr}</p>}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={rechazar} disabled={busy} className="text-red-600 font-medium px-4 py-3 rounded-xl text-sm hover:bg-red-50 disabled:opacity-50">Rechazar</button>
              <button onClick={despachar} disabled={busy} className="bg-brandit-orange text-white font-semibold px-6 py-3 rounded-xl text-sm hover:bg-brandit-orange/90 disabled:opacity-50 min-h-[44px]">{busy ? "Despachando…" : "Despachar y completar"}</button>
            </div>
          </div>
        )}
      </div>

      {/* Solo para impresión */}
      <div className="hidden print:block"><PrintDocument guia={g} /></div>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-gray-400">{label}</p><p className="font-medium text-brandit-black dark:text-gray-100 mt-0.5">{value}</p></div>;
}
