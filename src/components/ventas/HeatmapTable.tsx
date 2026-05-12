"use client";

import { fmtMoneyCompact, heatmapClasses } from "@/lib/ventas/format";

type Props = {
  /** Headers de columnas: MONTHS (12) o QUARTERS (4). */
  labels: readonly string[];
  /** Label de la fila current (ej. "2026"). */
  currentLabel: string;
  /** Label de la fila prev (ej. "2025"). */
  prevLabel: string;
  /** Valores del current year, alineados con labels. */
  current: (number | null)[];
  /** Valores del prev year, alineados con labels. */
  prev: (number | null)[];
  /**
   * Último index inclusive donde same-period es comparable. -1 = nada comparable.
   * Mensual: mesActual - 1. Trimestral: floor(mesActual / 3) - 1.
   * Para indices > maxComparableIndex: prev se maskea a "—" y current
   * pierde color de delta (queda stone). Opción B (quarter parcial visible).
   */
  maxComparableIndex: number;
};

export default function HeatmapTable({
  labels,
  currentLabel,
  prevLabel,
  current,
  prev,
  maxComparableIndex,
}: Props) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 bg-white sticky left-0 z-10" />
            {labels.map((label) => (
              <th
                key={label}
                className="px-3 py-3 text-right text-xs font-semibold text-gray-500"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Current year — colored cells */}
          <tr className="border-b border-gray-50">
            <td className="px-4 py-3 text-sm font-semibold text-brandit-black bg-white sticky left-0 z-10">
              {currentLabel}
            </td>
            {labels.map((label, i) => {
              const cur = current[i];
              const pre = prev[i];

              // Cell vacía si current no tiene valor.
              if (cur == null) {
                return (
                  <td key={label} className="px-3 py-3 text-right text-gray-300">
                    —
                  </td>
                );
              }

              // Comparativo válido solo si dentro del same-period AND prev tiene valor positivo.
              const comparable =
                i <= maxComparableIndex && pre != null && pre > 0;
              const delta = comparable ? (cur - pre!) / pre! : null;
              const { bg, fg } = heatmapClasses(delta);

              return (
                <td
                  key={label}
                  className={`px-3 py-3 text-right ${bg} ${fg}`}
                >
                  {fmtMoneyCompact(cur)}
                </td>
              );
            })}
          </tr>

          {/* Prev year — baseline, maskeado fuera de same-period */}
          <tr>
            <td className="px-4 py-3 text-sm font-medium text-gray-500 bg-white sticky left-0 z-10">
              {prevLabel}
            </td>
            {labels.map((label, i) => {
              const showPrev = i <= maxComparableIndex && prev[i] != null;
              if (!showPrev) {
                return (
                  <td key={label} className="px-3 py-3 text-right text-gray-300">
                    —
                  </td>
                );
              }
              return (
                <td key={label} className="px-3 py-3 text-right text-gray-500">
                  {fmtMoneyCompact(prev[i])}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
