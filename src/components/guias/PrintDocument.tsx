// PrintDocument A4 para Guías — portado del molde fashiongr.
// ADAPTADO Brand It: SIN columna EMPRESA (mono-empresa), logo brandit-logo.svg.
import type { Guia } from "./types";
import { fmtGuia, fmtFechaCorta } from "./types";

export default function PrintDocument({ guia: g }: { guia: Guia }) {
  const items = g.guia_items || [];
  const bultos = items.reduce((s, i) => s + (i.bultos || 0), 0);
  const isDirect = g.tipo_despacho === "directo";

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 8mm; }
          #print-document { font-size: 10px !important; padding: 12px !important; position: absolute; left: 0; top: 0; width: 100%; }
          #print-document h1 { font-size: 13px !important; margin-bottom: 8px !important; }
          #print-document table { font-size: 9px !important; }
          #print-document table th, #print-document table td { padding: 2px 4px !important; }
          #print-document .print-signatures { margin-top: 10px !important; gap: 16px !important; }
          #print-document .print-signatures img { height: 30px !important; }
          #print-document * { page-break-inside: avoid; }
        }
      `}</style>
      <div id="print-document" className="border border-gray-200 rounded-lg p-8 bg-white text-black" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif" }}>
        <div className="flex items-center justify-center gap-3 mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brandit-logo.svg" alt="Brand It" className="w-9 h-9 rounded object-contain" />
          <h1 className="text-lg font-bold uppercase tracking-wide">Guía de Transporte · Confecciones Boston</h1>
        </div>

        <div className="print-header grid grid-cols-2 gap-4 mb-4 text-sm">
          <Field label="N° GUÍA" value={fmtGuia(g.numero)} />
          <Field label="FECHA" value={fmtFechaCorta(g.fecha)} />
          <Field label="TRANSPORTISTA" value={g.transportista || " "} />
          <Field label="PLACA / VEHÍCULO" value={g.placa || " "} />
          <Field label="DESPACHADO POR" value={g.entregado_por || " "} />
          <Field label="TIPO" value={isDirect ? "Entrega directa" : "Transportista externo"} />
          {g.numero_guia_transp && <Field label="N° GUÍA TRANSP." value={g.numero_guia_transp} />}
          {isDirect && g.nombre_chofer && <Field label="CHOFER" value={g.nombre_chofer} />}
        </div>

        <hr className="border-gray-300 mb-4" />

        <table className="w-full text-xs border-collapse mb-4">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-2 py-1.5 font-medium w-8">#</th>
              <th className="border border-gray-300 px-2 py-1.5 font-medium text-left">CLIENTE</th>
              <th className="border border-gray-300 px-2 py-1.5 font-medium text-left">DIRECCIÓN</th>
              <th className="border border-gray-300 px-2 py-1.5 font-medium text-left">FACTURA(S)</th>
              <th className="border border-gray-300 px-2 py-1.5 font-medium w-16 text-center">BULTOS</th>
              <th className="border border-gray-300 px-2 py-1.5 font-medium text-left">N° GUÍA TRANSP.</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i}>
                <td className="border border-gray-300 px-2 py-1 text-center">{i + 1}</td>
                <td className="border border-gray-300 px-2 py-1">{item.cliente}</td>
                <td className="border border-gray-300 px-2 py-1">{item.direccion}</td>
                <td className="border border-gray-300 px-2 py-1">{item.facturas}</td>
                <td className="border border-gray-300 px-2 py-1 text-center">{item.bultos || ""}</td>
                <td className="border border-gray-300 px-2 py-1">{item.numero_guia_transp || g.numero_guia_transp || " "}</td>
              </tr>
            ))}
            <tr className="font-bold bg-gray-50">
              <td colSpan={4} className="border border-gray-300 px-2 py-1.5 text-right uppercase text-xs">Total de bultos despachados</td>
              <td className="border border-gray-300 px-2 py-1.5 text-center">{bultos}</td>
              <td className="border border-gray-300" />
            </tr>
          </tbody>
        </table>

        <div className="mb-8 text-xs">
          <div className="font-medium uppercase mb-1">Observaciones generales del envío</div>
          <div className="border border-gray-300 rounded p-2 min-h-[40px] whitespace-pre-wrap">{g.observaciones || ""}</div>
        </div>

        <div className="print-signatures grid grid-cols-2 gap-12 mt-12 text-xs">
          <div>
            <div className="font-medium uppercase mb-6">{isDirect ? "Chofer" : "Despachado por"}</div>
            <div className="mb-4">NOMBRE: <span className="ml-1 font-medium">{(isDirect ? g.nombre_chofer : g.entregado_por) || ""}</span>{!(isDirect ? g.nombre_chofer : g.entregado_por) && <span className="border-b border-gray-400 inline-block w-48 ml-1">&nbsp;</span>}</div>
            <div>FIRMA: {g.firma_base64 ? <img src={g.firma_base64} alt="Firma" style={{ height: 40 }} className="inline-block ml-1" /> : <span className="border-b border-gray-400 inline-block w-48 ml-1">&nbsp;</span>}</div>
            <div className="text-gray-400 mt-2 italic">Nombre y firma</div>
          </div>
          <div>
            <div className="font-medium uppercase mb-6">{isDirect ? "Recibido por — Cliente" : "Recibido conforme — Transportista"}</div>
            {!isDirect && <div className="mb-4">PLACA: <span className="ml-1 font-medium">{g.placa || ""}</span>{!g.placa && <span className="border-b border-gray-400 inline-block w-48 ml-1">&nbsp;</span>}</div>}
            <div className="mb-4">NOMBRE: <span className="ml-1 font-medium">{g.receptor_nombre || ""}</span>{!g.receptor_nombre && <span className="border-b border-gray-400 inline-block w-48 ml-1">&nbsp;</span>}</div>
            <div className="mb-4">CÉDULA: <span className="ml-1 font-medium">{g.cedula || ""}</span>{!g.cedula && <span className="border-b border-gray-400 inline-block w-48 ml-1">&nbsp;</span>}</div>
            <div>FIRMA: {g.firma_entregador_base64 ? <img src={g.firma_entregador_base64} alt="Firma" style={{ height: 40 }} className="inline-block ml-1" /> : <span className="border-b border-gray-400 inline-block w-48 ml-1">&nbsp;</span>}</div>
            <div className="text-gray-400 mt-2 italic">Nombre, cédula y firma</div>
          </div>
        </div>

        <div className="mt-8 pt-4 border-t border-gray-200 text-[9px] text-gray-400 text-center leading-relaxed">
          La firma constituye aceptación expresa de la mercancía detallada en este documento, en la cantidad y condición indicadas. Cualquier faltante o daño no reportado al momento de la recepción será responsabilidad exclusiva del transportista.
        </div>
      </div>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="font-medium">{label}:</span>
      <span className="border-b border-gray-300 flex-1 text-center">{value}</span>
    </div>
  );
}
