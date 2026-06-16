"use client";

import { RecordatorioPago } from "./types";
import { Modal } from "./ui";

function fmtMonto(monto: number | null): string {
  if (monto === null || monto === undefined) return "—";
  return "$" + new Intl.NumberFormat("es-PA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(monto);
}

function fmtFecha(fecha: string): string {
  const [y, m, d] = fecha.split("-");
  if (!y || !m || !d) return fecha;
  return `${d}/${m}/${y}`;
}

export default function CumplidosModal({
  open,
  onClose,
  cumplidos,
  loading,
  onRestore,
}: {
  open: boolean;
  onClose: () => void;
  cumplidos: RecordatorioPago[];
  loading: boolean;
  onRestore: (r: RecordatorioPago) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Recordatorios cumplidos" maxWidth="max-w-lg">
      {loading ? (
        <p className="text-center text-gray-400 text-sm py-8">Cargando...</p>
      ) : cumplidos.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-8">No hay recordatorios cumplidos.</p>
      ) : (
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {cumplidos.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 dark:border-gray-800 p-3"
            >
              <div className="min-w-0">
                <p className="font-medium text-gray-900 dark:text-white truncate">{r.cliente}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                  {fmtMonto(r.monto)} · prometido {fmtFecha(r.fecha_prometida)}
                </p>
                {r.cumplido_by && (
                  <p className="text-[11px] text-gray-400 mt-0.5">Marcado por {r.cumplido_by}</p>
                )}
              </div>
              <button
                onClick={() => onRestore(r)}
                className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 active:scale-[0.97] transition-all"
              >
                Restaurar
              </button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
