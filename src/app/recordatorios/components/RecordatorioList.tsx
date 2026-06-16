"use client";

import { RecordatorioPago } from "./types";
import { EmptyState, ScrollableTable, SkeletonTable } from "./ui";

// "Hoy" en Panamá (UTC-5 todo el año, sin DST) como YYYY-MM-DD.
// Se calcula con el offset fijo para no depender del timezone del browser.
export function hoyPanama(): string {
  return new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
}

function fmtMonto(monto: number | null): string {
  if (monto === null || monto === undefined) return "—";
  return "$" + new Intl.NumberFormat("es-PA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(monto);
}

function fmtFecha(fecha: string): string {
  // fecha es YYYY-MM-DD; formatear sin construir Date (evita corrimiento por TZ).
  const [y, m, d] = fecha.split("-");
  if (!y || !m || !d) return fecha;
  return `${d}/${m}/${y}`;
}

export default function RecordatorioList({
  recordatorios,
  loading,
  isAdmin,
  onNuevo,
  onEdit,
  onCumplir,
  onDelete,
}: {
  recordatorios: RecordatorioPago[];
  loading: boolean;
  isAdmin: boolean;
  onNuevo: () => void;
  onEdit: (r: RecordatorioPago) => void;
  onCumplir: (r: RecordatorioPago) => void;
  onDelete: (r: RecordatorioPago) => void;
}) {
  if (loading) return <SkeletonTable rows={5} cols={5} />;

  if (recordatorios.length === 0) {
    return (
      <EmptyState
        title="Sin recordatorios pendientes"
        subtitle="Registra una promesa de pago de un cliente para hacerle seguimiento."
        actionLabel="Nuevo recordatorio"
        onAction={onNuevo}
      />
    );
  }

  const hoy = hoyPanama();

  return (
    <>
      {/* Desktop: tabla */}
      <div className="hidden sm:block">
        <ScrollableTable minWidth={720}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100 dark:border-gray-800">
                <th className="py-2.5 px-3 font-medium">Cliente</th>
                <th className="py-2.5 px-3 font-medium">Monto</th>
                <th className="py-2.5 px-3 font-medium">Fecha prometida</th>
                <th className="py-2.5 px-3 font-medium">Nota</th>
                <th className="py-2.5 px-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {recordatorios.map((r) => {
                const vencido = r.fecha_prometida < hoy;
                return (
                  <tr key={r.id} className="border-b border-gray-50 dark:border-gray-800">
                    <td className="py-3 px-3 font-medium text-gray-900 dark:text-white">{r.cliente}</td>
                    <td className="py-3 px-3 tabular-nums text-gray-700 dark:text-gray-300">{fmtMonto(r.monto)}</td>
                    <td className="py-3 px-3 tabular-nums">
                      <span
                        className={
                          vencido
                            ? "text-red-600 dark:text-red-400 font-semibold"
                            : "text-gray-700 dark:text-gray-300"
                        }
                      >
                        {fmtFecha(r.fecha_prometida)}
                        {vencido && <span className="ml-1.5 text-[10px] font-bold uppercase">Vencido</span>}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-gray-500 dark:text-gray-400 max-w-[220px] truncate">{r.nota || "—"}</td>
                    <td className="py-3 px-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onCumplir(r)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-600 text-white hover:bg-green-700 active:scale-[0.97] transition-all"
                        >
                          Cumplido
                        </button>
                        <button
                          onClick={() => onEdit(r)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 active:scale-[0.97] transition-all"
                        >
                          Editar
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => onDelete(r)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 active:scale-[0.97] transition-all"
                          >
                            Borrar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ScrollableTable>
      </div>

      {/* Mobile: cards */}
      <div className="sm:hidden space-y-3">
        {recordatorios.map((r) => {
          const vencido = r.fecha_prometida < hoy;
          return (
            <div
              key={r.id}
              className={`rounded-xl border p-4 ${
                vencido
                  ? "border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20"
                  : "border-gray-100 dark:border-gray-800"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate">{r.cliente}</p>
                  <p className="text-sm tabular-nums text-gray-600 dark:text-gray-400">{fmtMonto(r.monto)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p
                    className={`text-sm tabular-nums font-semibold ${
                      vencido ? "text-red-600 dark:text-red-400" : "text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {fmtFecha(r.fecha_prometida)}
                  </p>
                  {vencido && <p className="text-[10px] font-bold uppercase text-red-600 dark:text-red-400">Vencido</p>}
                </div>
              </div>
              {r.nota && <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{r.nota}</p>}
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => onCumplir(r)}
                  className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-green-600 text-white hover:bg-green-700 active:scale-[0.97] transition-all min-h-[44px]"
                >
                  Cumplido
                </button>
                <button
                  onClick={() => onEdit(r)}
                  className="flex-1 px-3 py-2 rounded-lg text-xs font-medium border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 active:scale-[0.97] transition-all min-h-[44px]"
                >
                  Editar
                </button>
                {isAdmin && (
                  <button
                    onClick={() => onDelete(r)}
                    className="px-3 py-2 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 active:scale-[0.97] transition-all min-h-[44px]"
                  >
                    Borrar
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
