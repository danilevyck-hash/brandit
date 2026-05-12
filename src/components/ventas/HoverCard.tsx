"use client";

import type { Cliente } from "./types";
import { fmtMoney } from "@/lib/ventas/format";
import Sparkline from "./Sparkline";

type Props = {
  cliente: Cliente;
  monthly: number[];
  /** Posición fixed en viewport coordinates. */
  style: { top: number; left: number };
};

function daysSince(iso: string): number {
  if (!iso) return Infinity;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function activityTone(days: number): string {
  if (days <= 30) return "text-green-600";
  if (days <= 90) return "text-yellow-600";
  return "text-orange-600";
}

export default function HoverCard({ cliente, monthly, style }: Props) {
  const total = monthly.reduce((s, v) => s + (v ?? 0), 0);
  const mesesActivos = monthly.filter((v) => (v ?? 0) > 0).length;
  const promedioMensual = mesesActivos > 0 ? total / mesesActivos : 0;

  const days = daysSince(cliente.ultimaIso);
  const daysLabel = isFinite(days) ? `${days} días` : "—";
  const daysToneClass = activityTone(days);

  return (
    <div
      className="hidden md:block fixed bg-white border border-gray-200 rounded-lg shadow-lg p-4 w-72 z-50 pointer-events-none"
      style={{ top: style.top, left: style.left }}
    >
      <p className="text-sm font-medium text-brandit-black mb-3 truncate">{cliente.nombre}</p>

      <div className="mb-4">
        <Sparkline data={monthly} width={240} height={60} />
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-gray-400">Total 12m</p>
          <p className="font-semibold text-brandit-black mt-0.5 tabular-nums">{fmtMoney(total)}</p>
        </div>
        <div>
          <p className="text-gray-400">Promedio mensual</p>
          <p className="font-semibold text-brandit-black mt-0.5 tabular-nums">{fmtMoney(promedioMensual)}</p>
        </div>
        <div>
          <p className="text-gray-400">Meses activos</p>
          <p className="font-semibold text-brandit-black mt-0.5 tabular-nums">{mesesActivos}/12</p>
        </div>
        <div>
          <p className="text-gray-400">Actividad</p>
          <p className={`font-semibold mt-0.5 tabular-nums ${daysToneClass}`}>{daysLabel}</p>
        </div>
      </div>
    </div>
  );
}
