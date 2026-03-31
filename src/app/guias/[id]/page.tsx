"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

type GuiaItem = {
  id: string;
  orden: number;
  cliente: string;
  direccion: string;
  empresa: string;
  facturas: string;
  bultos: number;
  numero_guia_transp: string;
};

type Guia = {
  id: string;
  numero: number;
  fecha: string;
  transportista: string;
  placa: string;
  observaciones: string;
  items: GuiaItem[];
};

export default function GuiaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [guia, setGuia] = useState<Guia | null>(null);
  const [loading, setLoading] = useState(true);
  const [printMode, setPrintMode] = useState(false);
  const [role, setRole] = useState("");

  useEffect(() => { setRole(localStorage.getItem("brandit_role") || ""); }, []);
  const isAdmin = role === "admin";

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/guias/${params.id}`);
    const data = await res.json();
    if (data.error) { router.push("/guias"); return; }
    setGuia(data);
    setLoading(false);
  }, [params.id, router]);

  useEffect(() => { load(); }, [load]);

  const deleteGuia = async () => {
    if (!confirm("¿Eliminar esta guía y todos sus items?")) return;
    await fetch(`/api/guias/${params.id}`, { method: "DELETE" });
    router.push("/guias");
  };

  if (loading) return <div className="text-center py-24 text-gray-300">Cargando...</div>;
  if (!guia) return null;

  const totalBultos = guia.items.reduce((sum, i) => sum + Number(i.bultos || 0), 0);

  if (printMode) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white p-8 print:p-4">
          {/* Print header */}
          <div className="text-center mb-6 border-b-2 border-brandit-orange pb-4">
            <h1 className="text-xl font-bold tracking-tight uppercase">
              <span className="text-brandit-black">BRAND</span>
              <span className="text-brandit-blue">/</span>
              <span className="text-brandit-black">IT</span>
              <span className="text-brandit-orange">.</span>
            </h1>
            <p className="text-[10px] text-gray-500 font-medium">Confecciones Boston</p>
            <p className="text-sm font-bold text-brandit-black mt-2">GUÍA DE TRANSPORTE N°{guia.numero}</p>
          </div>

          <div className="flex justify-between text-sm mb-6">
            <div>
              <p><span className="font-semibold">Fecha:</span> {guia.fecha}</p>
              <p><span className="font-semibold">Transportista:</span> {guia.transportista}</p>
            </div>
            <div className="text-right">
              <p><span className="font-semibold">Placa:</span> {guia.placa}</p>
              {guia.observaciones && <p><span className="font-semibold">Obs:</span> {guia.observaciones}</p>}
            </div>
          </div>

          <table className="w-full text-xs">
            <thead>
              <tr className="border-b-2 border-brandit-orange text-left">
                <th className="py-2 font-semibold">N°</th>
                <th className="py-2 font-semibold">Cliente</th>
                <th className="py-2 font-semibold">Dirección</th>
                <th className="py-2 font-semibold">Empresa</th>
                <th className="py-2 font-semibold">Facturas</th>
                <th className="py-2 text-center font-semibold">Bultos</th>
                <th className="py-2 font-semibold"># Guía</th>
              </tr>
            </thead>
            <tbody>
              {guia.items.map((item, idx) => (
                <tr key={item.id} className="border-b border-gray-200">
                  <td className="py-1.5">{idx + 1}</td>
                  <td className="py-1.5">{item.cliente}</td>
                  <td className="py-1.5">{item.direccion}</td>
                  <td className="py-1.5">{item.empresa}</td>
                  <td className="py-1.5">{item.facturas}</td>
                  <td className="py-1.5 text-center">{item.bultos}</td>
                  <td className="py-1.5">{item.numero_guia_transp}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-brandit-orange font-bold text-sm">
                <td colSpan={5} className="py-2 text-right">Total Bultos:</td>
                <td className="py-2 text-center">{totalBultos}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>

          <div className="mt-16 grid grid-cols-3 gap-8 text-xs text-gray-500">
            <div className="text-center">
              <div className="border-t border-gray-400 w-full mb-1"></div>
              Despachado por
            </div>
            <div className="text-center">
              <div className="border-t border-gray-400 w-full mb-1"></div>
              Recibido por
            </div>
            <div className="text-center">
              <div className="border-t border-gray-400 w-full mb-1"></div>
              Transportista
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-4 print:hidden">
          <button onClick={() => setPrintMode(false)} className="text-sm text-gray-400 hover:text-brandit-black">← Volver</button>
          <button onClick={() => window.print()} className="bg-brandit-orange text-white rounded-xl px-6 py-2 text-sm font-medium">
            Imprimir
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link href="/guias" className="text-sm text-gray-400 hover:text-brandit-black transition-colors">← Guías</Link>
      </div>

      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Guía de Transporte</p>
          <h1 className="text-3xl font-bold text-brandit-black tracking-tight">Guía #{guia.numero}</h1>
          <p className="text-sm text-gray-400 mt-1">
            {guia.fecha} · {guia.transportista} · Placa: {guia.placa}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setPrintMode(true)}
            className="border border-gray-200 text-gray-600 rounded-xl px-4 py-2 text-sm hover:border-gray-300 transition-colors">
            Imprimir Guía
          </button>
          {isAdmin && (
            <button onClick={deleteGuia}
              className="border border-gray-200 text-red-400 rounded-xl px-4 py-2 text-sm hover:text-red-600 hover:border-red-200 transition-colors">
              Eliminar
            </button>
          )}
        </div>
      </div>

      {/* Transport info card */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Fecha</p>
          <p className="text-sm font-semibold text-brandit-black">{guia.fecha}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Transportista</p>
          <p className="text-sm font-semibold text-brandit-black">{guia.transportista}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Placa</p>
          <p className="text-sm font-semibold text-brandit-black">{guia.placa}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Total Bultos</p>
          <p className="text-2xl font-bold text-brandit-orange">{totalBultos}</p>
        </div>
      </div>

      {guia.observaciones && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6">
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Observaciones</p>
          <p className="text-sm text-gray-700">{guia.observaciones}</p>
        </div>
      )}

      {/* Items table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <p className="text-xs uppercase tracking-widest text-gray-400">{guia.items.length} Items de Entrega</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left">
              <th className="px-6 py-3 text-xs font-semibold text-gray-500">#</th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500">Cliente</th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500">Dirección</th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500">Empresa</th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500">Facturas</th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 text-center">Bultos</th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500"># Guía</th>
            </tr>
          </thead>
          <tbody>
            {guia.items.map((item, idx) => (
              <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-6 py-3 text-gray-400">{idx + 1}</td>
                <td className="px-6 py-3 text-gray-900 font-medium">{item.cliente}</td>
                <td className="px-6 py-3 text-gray-600">{item.direccion}</td>
                <td className="px-6 py-3 text-gray-600">{item.empresa}</td>
                <td className="px-6 py-3 text-gray-600">{item.facturas}</td>
                <td className="px-6 py-3 text-center font-semibold text-brandit-black">{item.bultos}</td>
                <td className="px-6 py-3 text-gray-600">{item.numero_guia_transp}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-200 bg-gray-50/50">
              <td colSpan={5} className="px-6 py-3 text-right text-xs font-semibold text-gray-500">Total Bultos:</td>
              <td className="px-6 py-3 text-center font-bold text-brandit-black">{totalBultos}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
