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
    if (data.error) {
      router.push("/guias");
      return;
    }
    setGuia(data);
    setLoading(false);
  }, [params.id, router]);

  useEffect(() => { load(); }, [load]);

  const deleteGuia = async () => {
    if (!confirm("¿Eliminar esta guía y todos sus items?")) return;
    await fetch(`/api/guias/${params.id}`, { method: "DELETE" });
    router.push("/guias");
  };

  if (loading) return <div className="text-center py-24 text-gray-300 text-lg">Cargando...</div>;
  if (!guia) return null;

  const totalBultos = guia.items.reduce((sum, i) => sum + Number(i.bultos || 0), 0);

  // Print view
  if (printMode) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl p-8 print:shadow-none print:rounded-none">
          <div className="text-center mb-6 border-b pb-4">
            <h1 className="text-2xl font-extrabold text-navy">Confecciones Boston</h1>
            <p className="text-lg font-semibold text-gray-700">Guía de Transporte #{guia.numero}</p>
          </div>
          <div className="flex justify-between text-sm mb-6">
            <div>
              <p><span className="font-semibold">Fecha:</span> {guia.fecha}</p>
              <p><span className="font-semibold">Transportista:</span> {guia.transportista}</p>
              <p><span className="font-semibold">Placa:</span> {guia.placa}</p>
            </div>
            {guia.observaciones && (
              <div className="text-right">
                <p><span className="font-semibold">Obs:</span> {guia.observaciones}</p>
              </div>
            )}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-navy text-left">
                <th className="py-2 text-navy">#</th>
                <th className="py-2 text-navy">Cliente</th>
                <th className="py-2 text-navy">Dirección</th>
                <th className="py-2 text-navy">Empresa</th>
                <th className="py-2 text-navy">Facturas</th>
                <th className="py-2 text-center text-navy">Bultos</th>
                <th className="py-2 text-navy"># Guía</th>
              </tr>
            </thead>
            <tbody>
              {guia.items.map((item, idx) => (
                <tr key={item.id} className="border-b border-gray-100">
                  <td className="py-2">{idx + 1}</td>
                  <td className="py-2">{item.cliente}</td>
                  <td className="py-2">{item.direccion}</td>
                  <td className="py-2">{item.empresa}</td>
                  <td className="py-2">{item.facturas}</td>
                  <td className="py-2 text-center">{item.bultos}</td>
                  <td className="py-2">{item.numero_guia_transp}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-navy font-bold">
                <td colSpan={5} className="py-2 text-right">Total Bultos:</td>
                <td className="py-2 text-center">{totalBultos}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
          <div className="mt-12 flex justify-between text-sm text-gray-400">
            <div className="text-center">
              <div className="border-t border-gray-300 w-48 mb-1"></div>
              Entregado por
            </div>
            <div className="text-center">
              <div className="border-t border-gray-300 w-48 mb-1"></div>
              Recibido por
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-4 print:hidden">
          <button onClick={() => setPrintMode(false)} className="text-sm text-gray-500 hover:text-navy">
            ← Volver
          </button>
          <button onClick={() => window.print()} className="bg-navy text-white font-semibold px-6 py-2 rounded-xl text-sm hover:bg-navy/90 transition-colors">
            Imprimir
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/guias" className="text-sm text-gray-400 hover:text-navy">← Guías</Link>
      </div>

      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Guía #{guia.numero}</h1>
          <p className="text-sm text-gray-400 mt-1">
            {guia.fecha} · {guia.transportista} · Placa: {guia.placa}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setPrintMode(true)} className="text-sm text-gray-500 hover:text-navy border border-gray-200 rounded-xl px-4 py-2">
            Imprimir
          </button>
          {isAdmin && (
            <button onClick={deleteGuia} className="text-sm text-red-400 hover:text-red-600 border border-gray-200 rounded-xl px-4 py-2">
              Eliminar
            </button>
          )}
        </div>
      </div>

      {guia.observaciones && (
        <div className="bg-white rounded-2xl border border-gray-50 p-5 mb-6">
          <p className="text-xs text-gray-400 mb-1">Observaciones</p>
          <p className="text-sm text-gray-700">{guia.observaciones}</p>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-50 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left">
              <th className="px-5 py-3 text-xs font-semibold text-navy">#</th>
              <th className="px-5 py-3 text-xs font-semibold text-navy">Cliente</th>
              <th className="px-5 py-3 text-xs font-semibold text-navy">Dirección</th>
              <th className="px-5 py-3 text-xs font-semibold text-navy">Empresa</th>
              <th className="px-5 py-3 text-xs font-semibold text-navy">Facturas</th>
              <th className="px-5 py-3 text-xs font-semibold text-navy text-center">Bultos</th>
              <th className="px-5 py-3 text-xs font-semibold text-navy"># Guía</th>
            </tr>
          </thead>
          <tbody>
            {guia.items.map((item, idx) => (
              <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-5 py-3 text-gray-400">{idx + 1}</td>
                <td className="px-5 py-3 text-gray-900 font-medium">{item.cliente}</td>
                <td className="px-5 py-3 text-gray-600">{item.direccion}</td>
                <td className="px-5 py-3 text-gray-600">{item.empresa}</td>
                <td className="px-5 py-3 text-gray-600">{item.facturas}</td>
                <td className="px-5 py-3 text-center text-gray-900 font-semibold">{item.bultos}</td>
                <td className="px-5 py-3 text-gray-600">{item.numero_guia_transp}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-100 font-semibold">
              <td colSpan={5} className="px-5 py-3 text-right text-gray-500 text-xs">Total Bultos:</td>
              <td className="px-5 py-3 text-center text-navy">{totalBultos}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
