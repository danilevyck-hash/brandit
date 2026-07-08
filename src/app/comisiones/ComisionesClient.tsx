"use client";

// Módulo Comisiones (por cobros) — vista principal, filtros, generación de
// snapshot mensual e histórico. Solo admin. Cálculo en vivo del mes salvo que ya
// exista un cierre (snapshot), en cuyo caso se muestra congelado.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/Toast";
import { formatCurrency, fmtDate } from "@/lib/format";
import { vendedorToken, round2 } from "@/lib/comisiones";
import { ConfirmModal, MultiSelect, type MultiOption } from "./ui";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

interface Recibo {
  id: number;
  fecha: string | null;
  cliente_codigo: string | null;
  cliente_nombre: string | null;
  vendedor_id: number | null;
  vendedor_nombre: string | null;
  total: number;
  tasa: number;
  comision: number;
}
interface Retencion { id: number; fecha: string | null; cliente_nombre: string | null; total: number }
interface VendedorOpt { token: string; id: number | null; nombre: string | null }
interface ClienteOpt { codigo: string; nombre: string | null }
interface SnapshotCab {
  id: number; generado_at: string; generado_por: string | null;
  total_cobrado: number; total_comision: number;
}
interface ApiResp {
  anio: number; mes: number; frozen: boolean; esMesEnCurso: boolean;
  snapshot: SnapshotCab | null;
  recibos: Recibo[];
  porVendedor: unknown[];
  retenciones: Retencion[];
  vendedoresDisponibles: VendedorOpt[];
  clientesDisponibles: ClienteOpt[];
  totalCobrado: number;
  totalComision: number;
}
interface HistItem {
  id: number; anio: number; mes: number;
  total_cobrado: number; total_comision: number;
  generado_por: string | null; generado_at: string;
}

export default function ComisionesClient() {
  const { toast } = useToast();
  // Mes/año actual capturado UNA vez (estable entre renders).
  const [cur] = useState(() => {
    const d = new Date();
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
  });
  const [anio, setAnio] = useState(cur.y);
  const [mes, setMes] = useState(cur.m);

  const [data, setData] = useState<ApiResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selecciones (INCLUIDOS). Todos marcados por default al cargar un mes nuevo.
  const [vendSel, setVendSel] = useState<Set<string>>(new Set());
  const [cliSel, setCliSel] = useState<Set<string>>(new Set());
  const [initFor, setInitFor] = useState<string>("");

  const [showRetenciones, setShowRetenciones] = useState(false);
  const [confirmGen, setConfirmGen] = useState(false);
  const [confirmForce, setConfirmForce] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [hist, setHist] = useState<HistItem[]>([]);
  const [showHist, setShowHist] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/comisiones?anio=${anio}&mes=${mes}`, { cache: "no-store" });
      const body = (await res.json()) as ApiResp & { error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setData(body);
      const key = `${anio}-${mes}`;
      if (!body.frozen && initFor !== key) {
        setVendSel(new Set(body.vendedoresDisponibles.map((v) => v.token)));
        setCliSel(new Set(body.clientesDisponibles.map((c) => c.codigo)));
        setInitFor(key);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [anio, mes, initFor]);

  useEffect(() => { void load(); }, [load]);

  const loadHist = useCallback(async () => {
    try {
      const res = await fetch("/api/comisiones/historial", { cache: "no-store" });
      if (res.ok) setHist((await res.json()) as HistItem[]);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { void loadHist(); }, [loadHist]);

  // Vista filtrada (client-side, instantánea) sobre los recibos del mes.
  const frozen = data?.frozen ?? false;
  const excluidos = useMemo(() => {
    if (!data) return new Set<string>();
    return new Set(data.clientesDisponibles.map((c) => c.codigo).filter((c) => !cliSel.has(c)));
  }, [data, cliSel]);

  const visibles = useMemo<Recibo[]>(() => {
    if (!data) return [];
    if (frozen) return data.recibos;
    return data.recibos.filter((r) => {
      const tok = vendedorToken(r.vendedor_id, r.vendedor_nombre);
      if (!vendSel.has(tok)) return false;
      if (r.cliente_codigo && excluidos.has(r.cliente_codigo)) return false;
      return true;
    });
  }, [data, frozen, vendSel, excluidos]);

  const totalCobrado = frozen ? (data?.totalCobrado ?? 0) : round2(visibles.reduce((a, r) => a + r.total, 0));
  const totalComision = frozen ? (data?.totalComision ?? 0) : round2(visibles.reduce((a, r) => a + r.comision, 0));

  const vendOptions: MultiOption[] = (data?.vendedoresDisponibles ?? []).map((v) => ({
    value: v.token, label: v.nombre ?? "(sin vendedor)",
  }));
  const cliOptions: MultiOption[] = (data?.clientesDisponibles ?? []).map((c) => ({
    value: c.codigo, label: c.nombre ?? c.codigo,
  }));

  const doGenerate = async (force: boolean) => {
    setGenerating(true);
    try {
      const res = await fetch("/api/comisiones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anio, mes, force,
          vendedores: Array.from(vendSel),
          clientes_excluidos: Array.from(excluidos),
        }),
      });
      const body = await res.json();
      if (res.status === 409 && body.needsConfirm) {
        setConfirmGen(false);
        setConfirmForce(true);
        return;
      }
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      toast("Comisiones generadas", "success");
      setConfirmGen(false);
      setConfirmForce(false);
      await load();
      await loadHist();
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo generar.", "error");
    } finally {
      setGenerating(false);
    }
  };

  const doDelete = async () => {
    if (!data?.snapshot) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/comisiones/${data.snapshot.id}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      toast("Cierre eliminado. Puedes regenerar.", "success");
      setConfirmDel(false);
      setInitFor(""); // fuerza re-inicializar filtros al volver a vivo
      await load();
      await loadHist();
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo eliminar.", "error");
    } finally {
      setDeleting(false);
    }
  };

  const years = useMemo(() => [cur.y, cur.y - 1, cur.y - 2], [cur.y]);

  const mesFuturo = (m: number) => anio === cur.y && m > cur.m;

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Comisiones</h1>
            <p className="text-sm text-gray-400">Comisión sobre cobros del mes</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={mes}
              onChange={(e) => setMes(parseInt(e.target.value, 10))}
              className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 min-h-[44px]"
            >
              {MESES.map((m, i) => (
                <option key={i} value={i + 1} disabled={mesFuturo(i + 1)}>{m}</option>
              ))}
            </select>
            <select
              value={anio}
              onChange={(e) => setAnio(parseInt(e.target.value, 10))}
              className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 min-h-[44px]"
            >
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 px-4 py-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Badge snapshot */}
        {frozen && data?.snapshot && (
          <div className="mb-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
            <span className="text-sm text-emerald-700 dark:text-emerald-400">
              ✓ Cierre generado el {fmtDate(String(data.snapshot.generado_at).slice(0, 10))}
              {data.snapshot.generado_por ? ` · por ${data.snapshot.generado_por}` : ""}
            </span>
            <button
              onClick={() => setConfirmDel(true)}
              className="px-3 py-2 rounded-xl text-xs font-medium border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 active:scale-[0.97] transition-all min-h-[44px]"
            >
              Eliminar y regenerar
            </button>
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
            <p className="text-xs text-gray-400 mb-1">Total cobrado</p>
            <p className="text-2xl font-semibold text-gray-900 dark:text-white tabular-nums">{formatCurrency(totalCobrado)}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4 bg-brandit-orange/5">
            <p className="text-xs text-gray-400 mb-1">Total comisión</p>
            <p className="text-2xl font-semibold text-brandit-orange tabular-nums">{formatCurrency(totalComision)}</p>
          </div>
        </div>

        {/* Filtros (solo en vivo) */}
        {!frozen && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
            <MultiSelect
              label="Vendedores"
              options={vendOptions}
              selected={vendSel}
              onChange={setVendSel}
            />
            <MultiSelect
              label="Clientes"
              options={cliOptions}
              selected={cliSel}
              onChange={setCliSel}
              searchable
              placeholder="Buscar cliente..."
            />
          </div>
        )}

        {/* Tabla recibos */}
        {loading ? (
          <div className="py-20 text-center text-sm text-gray-400">Cargando…</div>
        ) : visibles.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400 border border-dashed border-gray-200 dark:border-gray-800 rounded-2xl">
            Sin recibos {MESES[mes - 1]} {anio}.
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden sm:block overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900 text-left text-xs uppercase tracking-wide text-gray-400">
                    <th className="px-4 py-2.5 font-medium">Fecha</th>
                    <th className="px-4 py-2.5 font-medium">Cliente</th>
                    <th className="px-4 py-2.5 font-medium">Vendedor</th>
                    <th className="px-4 py-2.5 text-right font-medium">Total</th>
                    <th className="px-4 py-2.5 text-right font-medium">Tasa</th>
                    <th className="px-4 py-2.5 text-right font-medium">Comisión</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((r) => (
                    <tr key={r.id} className="border-t border-gray-100 dark:border-gray-800">
                      <td className="px-4 py-2.5 whitespace-nowrap text-gray-500 dark:text-gray-400">{fmtDate(r.fecha ?? "")}</td>
                      <td className="px-4 py-2.5 text-gray-800 dark:text-gray-200">{r.cliente_nombre ?? r.cliente_codigo ?? "-"}</td>
                      <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">{r.vendedor_nombre ?? "-"}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-gray-800 dark:text-gray-200">{formatCurrency(r.total)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-gray-400">{(r.tasa * 100).toFixed(1)}%</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium text-gray-900 dark:text-white">{formatCurrency(r.comision)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 font-semibold text-gray-900 dark:text-white">
                    <td className="px-4 py-2.5" colSpan={3}>Total ({visibles.length})</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(totalCobrado)}</td>
                    <td></td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(totalComision)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden space-y-2">
              {visibles.map((r) => (
                <div key={r.id} className="rounded-2xl border border-gray-200 dark:border-gray-800 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{r.cliente_nombre ?? r.cliente_codigo ?? "-"}</p>
                    <span className="text-xs text-gray-400 shrink-0">{fmtDate(r.fecha ?? "")}</span>
                  </div>
                  <p className="text-xs text-gray-400 mb-2">{r.vendedor_nombre ?? "-"}</p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 tabular-nums">{formatCurrency(r.total)} · {(r.tasa * 100).toFixed(1)}%</span>
                    <span className="font-semibold text-brandit-orange tabular-nums">{formatCurrency(r.comision)}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Retenciones excluidas (informativo, solo en vivo) */}
        {!frozen && (data?.retenciones.length ?? 0) > 0 && (
          <div className="mt-5 rounded-2xl border border-gray-200 dark:border-gray-800">
            <button
              onClick={() => setShowRetenciones((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900 rounded-2xl"
            >
              <span>{data!.retenciones.length} retenciones de ITBMS excluidas (no comisionan)</span>
              <span>{showRetenciones ? "▾" : "▸"}</span>
            </button>
            {showRetenciones && (
              <div className="px-4 pb-3 divide-y divide-gray-100 dark:divide-gray-800">
                {data!.retenciones.map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-gray-600 dark:text-gray-300">{r.cliente_nombre ?? "-"}</span>
                    <span className="text-gray-400 tabular-nums">{fmtDate(r.fecha ?? "")} · {formatCurrency(r.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Generar */}
        {!frozen && (
          <div className="mt-6 flex justify-end">
            <button
              onClick={() => setConfirmGen(true)}
              disabled={loading || visibles.length === 0}
              className="px-5 py-2.5 rounded-xl text-sm font-medium bg-brandit-orange text-white hover:opacity-90 active:scale-[0.97] transition-all min-h-[44px] disabled:opacity-40"
            >
              Generar comisiones del mes
            </button>
          </div>
        )}

        {/* Histórico */}
        <div className="mt-10">
          <button
            onClick={() => setShowHist((v) => !v)}
            className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-brandit-orange transition-colors"
          >
            {showHist ? "▾" : "▸"} Histórico de cierres ({hist.length})
          </button>
          {showHist && (
            <div className="mt-3 rounded-2xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
              {hist.length === 0 && <p className="px-4 py-4 text-sm text-gray-400">Aún no hay cierres generados.</p>}
              {hist.map((h) => (
                <button
                  key={h.id}
                  onClick={() => { setAnio(h.anio); setMes(h.mes); setInitFor(""); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{MESES[h.mes - 1]} {h.anio}</p>
                    <p className="text-xs text-gray-400">Generado {fmtDate(String(h.generado_at).slice(0, 10))}{h.generado_por ? ` · ${h.generado_por}` : ""}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-brandit-orange tabular-nums">{formatCurrency(Number(h.total_comision))}</p>
                    <p className="text-xs text-gray-400 tabular-nums">cobrado {formatCurrency(Number(h.total_cobrado))}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Confirmar generación (normal) */}
      <ConfirmModal
        open={confirmGen}
        onClose={() => setConfirmGen(false)}
        onConfirm={() => void doGenerate(false)}
        title={`Generar comisiones de ${MESES[mes - 1]} ${anio}`}
        message={`Se congelará el cierre con ${visibles.length} recibos · comisión ${formatCurrency(totalComision)}. Podrás eliminarlo para regenerar.`}
        confirmLabel="Generar"
        loading={generating}
      />
      {/* Confirmar generación de mes en curso (force) */}
      <ConfirmModal
        open={confirmForce}
        onClose={() => setConfirmForce(false)}
        onConfirm={() => void doGenerate(true)}
        title="El mes aún está en curso"
        message="Todavía pueden entrar más cobros este mes. ¿Generar el cierre de todas formas?"
        confirmLabel="Generar igual"
        destructive
        loading={generating}
      />
      {/* Confirmar eliminación */}
      <ConfirmModal
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        onConfirm={() => void doDelete()}
        title="Eliminar cierre"
        message="Se borrará el cierre congelado de este mes para poder regenerarlo. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        destructive
        loading={deleting}
      />
    </div>
  );
}
