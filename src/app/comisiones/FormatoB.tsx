"use client";

// UI del FORMATO B de comisiones (venta + cobro, 1% fijo):
//   - FormatoBSection: tabla resumen por vendedor (Ventas, Com. venta, Cobros,
//     Com. cobro, Total), filas clicables → drill-down.
//   - DetalleBModal: VENTAS (fecha, cliente, número, tipo, subtotal firmado) +
//     COBROS (fecha, cliente, monto) + CIERRE (bases × 1% → total).
//   - FormatosConfigModal: asignar formato A|B por vendedor (tasas NO configurables).

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import { formatCurrency, fmtDate } from "@/lib/format";
import { Modal } from "./ui";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export interface FormatoBMes {
  mes: number;
  ventas_base: number;
  cobros_base: number;
  comision_venta: number;
  comision_cobro: number;
}
export interface FormatoBVendedor {
  vendedor: string;
  porMes: FormatoBMes[];
  ventas_base: number;
  cobros_base: number;
  comision_venta: number;
  comision_cobro: number;
  comision_total: number;
}

// ─── Resumen ──────────────────────────────────────────────────────────────────

export function FormatoBSection({
  vendedores, onVerDetalle,
}: { vendedores: FormatoBVendedor[]; onVerDetalle: (vendedor: string) => void }) {
  if (vendedores.length === 0) return null;
  const tot = (k: keyof FormatoBVendedor) =>
    Math.round(vendedores.reduce((a, v) => a + (v[k] as number), 0) * 100) / 100;

  return (
    <div className="mb-5 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Formato B — venta + cobro (1%)</p>
        <p className="text-xs text-gray-400">Ventas por vendedor de factura · cobros por cartera del cliente. Toca un vendedor para ver el detalle.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100 dark:border-gray-800">
              <th className="px-4 py-2 font-medium">Vendedor</th>
              <th className="px-4 py-2 text-right font-medium">Ventas</th>
              <th className="px-4 py-2 text-right font-medium">Com. venta</th>
              <th className="px-4 py-2 text-right font-medium">Cobros</th>
              <th className="px-4 py-2 text-right font-medium">Com. cobro</th>
              <th className="px-4 py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {vendedores.map((v) => (
              <tr
                key={v.vendedor}
                onClick={() => onVerDetalle(v.vendedor)}
                title="Ver detalle"
                className="border-b border-gray-50 dark:border-gray-800/60 last:border-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900"
              >
                <td className="px-4 py-2.5 text-gray-800 dark:text-gray-200 font-medium whitespace-nowrap">{v.vendedor}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{formatCurrency(v.ventas_base)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-gray-500">{formatCurrency(v.comision_venta)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{formatCurrency(v.cobros_base)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-gray-500">{formatCurrency(v.comision_cobro)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-brandit-orange">{formatCurrency(v.comision_total)}</td>
              </tr>
            ))}
          </tbody>
          {vendedores.length > 1 && (
            <tfoot>
              <tr className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 font-semibold text-gray-900 dark:text-white">
                <td className="px-4 py-2.5">Total</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(tot("ventas_base"))}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(tot("comision_venta"))}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(tot("cobros_base"))}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(tot("comision_cobro"))}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(tot("comision_total"))}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

// ─── Drill-down ───────────────────────────────────────────────────────────────

interface VentaDoc { mes: number; fecha: string | null; cliente: string | null; numero: string | null; tipo: string; subtotal: number }
interface CobroDoc { mes: number; fecha: string | null; cliente: string | null; monto: number }
interface DetalleB {
  vendedor: string; frozen: boolean;
  ventas: VentaDoc[]; cobros: CobroDoc[];
  cierre: {
    porMes: FormatoBMes[];
    ventas_base: number; cobros_base: number;
    comision_venta: number; comision_cobro: number; comision_total: number;
  };
}

export function DetalleBModal({
  anio, meses, vendedor, onClose,
}: { anio: number; meses: number[]; vendedor: string; onClose: () => void }) {
  const [data, setData] = useState<DetalleB | null>(null);
  const [error, setError] = useState<string | null>(null);
  const multi = meses.length > 1;

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(
        `/api/comisiones/detalle-b?anio=${anio}&meses=${meses.join(",")}&vendedor=${encodeURIComponent(vendedor)}`,
        { cache: "no-store" },
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setData(body as DetalleB);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el detalle.");
    }
  }, [anio, meses, vendedor]);

  useEffect(() => { void load(); }, [load]);

  const periodo = meses.map((m) => MESES[m - 1]).join(", ") + ` ${anio}`;

  return (
    <Modal open onClose={onClose} maxWidth="max-w-3xl">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Comisión — {vendedor}</h2>
          <p className="text-xs text-gray-400">{periodo}{data?.frozen ? " · cierre congelado" : ""}</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none px-2" aria-label="Cerrar">×</button>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400 py-6">{error}</p>}
      {!error && !data && <p className="text-sm text-gray-400 py-6">Cargando…</p>}

      {data && (
        <div className="space-y-5 mt-3">
          {/* VENTAS */}
          <div>
            <h3 className="text-xs uppercase tracking-wide font-medium text-gray-400 mb-2">Ventas</h3>
            <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900 text-left text-xs uppercase tracking-wide text-gray-400">
                    {multi && <th className="px-3 py-2 font-medium">Mes</th>}
                    <th className="px-3 py-2 font-medium">Fecha</th>
                    <th className="px-3 py-2 font-medium">Cliente</th>
                    <th className="px-3 py-2 font-medium">Número</th>
                    <th className="px-3 py-2 text-center font-medium">Tipo</th>
                    <th className="px-3 py-2 text-right font-medium">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {data.ventas.length === 0 && (
                    <tr><td colSpan={multi ? 6 : 5} className="px-3 py-4 text-center text-gray-400">Sin ventas en el período.</td></tr>
                  )}
                  {data.ventas.map((v, i) => (
                    <tr key={i} className="border-t border-gray-100 dark:border-gray-800">
                      {multi && <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{MESES[v.mes - 1].slice(0, 3)}</td>}
                      <td className="px-3 py-2 whitespace-nowrap text-gray-500">{fmtDate(v.fecha ?? "")}</td>
                      <td className="px-3 py-2 text-gray-800 dark:text-gray-200">{v.cliente ?? "-"}</td>
                      <td className="px-3 py-2 tabular-nums text-gray-500">{v.numero ?? "-"}</td>
                      <td className="px-3 py-2 text-center text-gray-500">{v.tipo}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${v.subtotal < 0 ? "text-red-600 dark:text-red-400" : "text-gray-800 dark:text-gray-200"}`}>
                        {formatCurrency(v.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 font-semibold text-gray-900 dark:text-white">
                    <td className="px-3 py-2" colSpan={multi ? 5 : 4}>TOTAL VENTAS ({data.ventas.length})</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(data.cierre.ventas_base)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* COBROS */}
          <div>
            <h3 className="text-xs uppercase tracking-wide font-medium text-gray-400 mb-2">Cobros (por cartera)</h3>
            <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900 text-left text-xs uppercase tracking-wide text-gray-400">
                    {multi && <th className="px-3 py-2 font-medium">Mes</th>}
                    <th className="px-3 py-2 font-medium">Fecha</th>
                    <th className="px-3 py-2 font-medium">Cliente</th>
                    <th className="px-3 py-2 text-right font-medium">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {data.cobros.length === 0 && (
                    <tr><td colSpan={multi ? 4 : 3} className="px-3 py-4 text-center text-gray-400">Sin cobros en el período.</td></tr>
                  )}
                  {data.cobros.map((c, i) => (
                    <tr key={i} className="border-t border-gray-100 dark:border-gray-800">
                      {multi && <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{MESES[c.mes - 1].slice(0, 3)}</td>}
                      <td className="px-3 py-2 whitespace-nowrap text-gray-500">{fmtDate(c.fecha ?? "")}</td>
                      <td className="px-3 py-2 text-gray-800 dark:text-gray-200">{c.cliente ?? "-"}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-800 dark:text-gray-200">{formatCurrency(c.monto)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 font-semibold text-gray-900 dark:text-white">
                    <td className="px-3 py-2" colSpan={multi ? 3 : 2}>TOTAL COBROS ({data.cobros.length})</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(data.cierre.cobros_base)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="text-xs text-gray-400 mt-1">Excluye retenciones de ITBMS. El API de Switch no expone el número de recibo.</p>
          </div>

          {/* CIERRE */}
          <div className="border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
            <h3 className="text-xs uppercase tracking-wide font-medium text-gray-400 mb-3">Cierre</h3>
            {multi && (
              <div className="mb-3 space-y-1">
                {data.cierre.porMes.map((m) => (
                  <div key={m.mes} className="flex justify-between text-xs text-gray-500">
                    <span>{MESES[m.mes - 1]}: ventas {formatCurrency(m.ventas_base)} · cobros {formatCurrency(m.cobros_base)}</span>
                    <span className="tabular-nums">{formatCurrency(Math.round((m.comision_venta + m.comision_cobro) * 100) / 100)}</span>
                  </div>
                ))}
              </div>
            )}
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-600 dark:text-gray-300">Ventas {formatCurrency(data.cierre.ventas_base)} × 1%</dt>
                <dd className="tabular-nums text-gray-800 dark:text-gray-200">{formatCurrency(data.cierre.comision_venta)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600 dark:text-gray-300">Cobros {formatCurrency(data.cierre.cobros_base)} × 1%</dt>
                <dd className="tabular-nums text-gray-800 dark:text-gray-200">{formatCurrency(data.cierre.comision_cobro)}</dd>
              </div>
              <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-2 font-semibold text-base text-gray-900 dark:text-white">
                <dt>Comisión total</dt>
                <dd className="tabular-nums text-brandit-orange">{formatCurrency(data.cierre.comision_total)}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── Config de formatos ───────────────────────────────────────────────────────

interface ConfigRow { vendedor_nombre: string; formato: "A" | "B"; activo: boolean }

export function FormatosConfigModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<ConfigRow[]>([]);
  const [sinAsignar, setSinAsignar] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/comisiones/formatos", { cache: "no-store" });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
        setRows((body.config as ConfigRow[]) ?? []);
        setSinAsignar((body.sinAsignar as string[]) ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo cargar.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const setFormato = (nombre: string, formato: "A" | "B") =>
    setRows((prev) => prev.map((r) => (r.vendedor_nombre === nombre ? { ...r, formato } : r)));
  const setActivo = (nombre: string, activo: boolean) =>
    setRows((prev) => prev.map((r) => (r.vendedor_nombre === nombre ? { ...r, activo } : r)));
  const asignar = (nombre: string, formato: "A" | "B") => {
    setSinAsignar((prev) => prev.filter((n) => n !== nombre));
    setRows((prev) => [...prev, { vendedor_nombre: nombre, formato, activo: true }]
      .sort((a, b) => a.vendedor_nombre.localeCompare(b.vendedor_nombre)));
  };

  const guardar = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/comisiones/formatos", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: rows }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      toast("Formatos guardados", "success");
      onSaved();
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo guardar.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Formato de comisión por vendedor" maxWidth="max-w-lg">
      <p className="text-xs text-gray-400 mb-4">
        Formato A: tramos por recibo (menos de $15,000 → 0.5%, desde $15,000 → 1%).
        Formato B: 1% sobre ventas (vendedor de factura) + 1% sobre cobros (cartera).
        Las tasas no se pueden cambiar.
      </p>
      {loading && <p className="text-sm text-gray-400 py-4">Cargando…</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400 py-4">{error}</p>}
      {!loading && !error && (
        <>
          <div className="divide-y divide-gray-100 dark:divide-gray-800 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden mb-4">
            {rows.map((r) => (
              <div key={r.vendedor_nombre} className={`flex items-center justify-between gap-3 px-3 py-2.5 ${r.activo ? "" : "opacity-50"}`}>
                <span className="text-sm text-gray-800 dark:text-gray-200 truncate">{r.vendedor_nombre}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={r.formato}
                    onChange={(e) => setFormato(r.vendedor_nombre, e.target.value as "A" | "B")}
                    className="px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs text-gray-700 dark:text-gray-200"
                  >
                    <option value="A">A — tramos</option>
                    <option value="B">B — venta+cobro</option>
                  </select>
                  <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={r.activo}
                      onChange={(e) => setActivo(r.vendedor_nombre, e.target.checked)}
                      className="accent-brandit-orange w-4 h-4"
                    />
                    Activo
                  </label>
                </div>
              </div>
            ))}
            {rows.length === 0 && <p className="px-3 py-4 text-sm text-gray-400">Sin vendedores configurados.</p>}
          </div>

          {sinAsignar.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-medium text-gray-500 mb-2">Vendedores sin formato asignado (últimos 3 meses):</p>
              <div className="space-y-1.5">
                {sinAsignar.map((n) => (
                  <div key={n} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50">
                    <span className="text-sm text-amber-800 dark:text-amber-300 truncate">{n}</span>
                    <div className="flex gap-1.5 shrink-0">
                      <button onClick={() => asignar(n, "A")} className="px-2.5 py-1 rounded-lg text-xs border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40">Formato A</button>
                      <button onClick={() => asignar(n, "B")} className="px-2.5 py-1 rounded-lg text-xs border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40">Formato B</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => void guardar()}
              disabled={saving || rows.length === 0}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-brandit-orange text-white hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-40 min-h-[44px]"
            >
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
            <button
              onClick={onClose}
              disabled={saving}
              className="flex-1 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 px-4 py-2.5 rounded-xl text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-all disabled:opacity-50 min-h-[44px]"
            >
              Cancelar
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
