"use client";

// Módulo Comisiones (por cobros) — vista principal, filtros, generación de
// snapshot mensual e histórico. Solo admin. Cálculo en vivo del mes salvo que ya
// exista un cierre (snapshot), en cuyo caso se muestra congelado.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/Toast";
import { formatCurrency, fmtDate } from "@/lib/format";
import { vendedorToken, round2 } from "@/lib/comisiones";
import { ConfirmModal, MultiSelect, type MultiOption } from "./ui";
import { FormatoBSection, DetalleBModal, FormatosConfigModal, type FormatoBVendedor } from "./FormatoB";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

interface Recibo {
  id: number;
  mes: number;
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
  anio: number; mes: number; meses: number[]; mesesConCierre: number[];
  frozen: boolean; esMesEnCurso: boolean;
  formatoB: FormatoBVendedor[];
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
  // Meses seleccionados (multi-select). Un solo mes = comportamiento clásico
  // (snapshot congelado, generar cierre); varios = vista combinada en vivo.
  const [mesesSel, setMesesSel] = useState<Set<string>>(new Set([String(cur.m)]));
  const meses = useMemo(
    () => Array.from(mesesSel).map(Number).sort((a, b) => a - b),
    [mesesSel],
  );
  const multi = meses.length > 1;
  const mes = meses[0] ?? cur.m; // mes único (solo válido cuando !multi)

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

  // Formato B: drill-down por vendedor + modal de config de formatos.
  const [detalleBVendedor, setDetalleBVendedor] = useState<string | null>(null);
  const [showFormatos, setShowFormatos] = useState(false);

  // Tab Formato A | Formato B (patrón VentasShell). Se recuerda en localStorage;
  // se lee en effect (no en el initializer) para no divergir en la hidratación.
  const [tabFormato, setTabFormato] = useState<"A" | "B">("A");
  useEffect(() => {
    const saved = localStorage.getItem("brandit_comisiones_tab");
    if (saved === "A" || saved === "B") setTabFormato(saved);
  }, []);
  const cambiarTab = (t: "A" | "B") => {
    setTabFormato(t);
    localStorage.setItem("brandit_comisiones_tab", t);
  };

  const load = useCallback(async () => {
    if (meses.length === 0) {
      setData(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/comisiones?anio=${anio}&meses=${meses.join(",")}`, { cache: "no-store" });
      const body = (await res.json()) as ApiResp & { error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setData(body);
      const key = `${anio}-${meses.join(",")}`;
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
  }, [anio, meses, initFor]);

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

  // Totales de la tabla A (siempre = suma de sus filas visibles).
  const totalCobradoA = round2(visibles.reduce((a, r) => a + r.total, 0));
  const totalComisionA = round2(visibles.reduce((a, r) => a + r.comision, 0));

  const formatoB = data?.formatoB ?? [];
  const bCobros = round2(formatoB.reduce((a, v) => a + v.cobros_base, 0));
  const bComision = round2(formatoB.reduce((a, v) => a + v.comision_total, 0));

  // KPIs del período = A + B. En congelado la cabecera del snapshot YA trae
  // ambos formatos sumados; en vivo se suma acá.
  const totalCobrado = frozen ? (data?.totalCobrado ?? 0) : round2(totalCobradoA + bCobros);
  const totalComision = frozen ? (data?.totalComision ?? 0) : round2(totalComisionA + bComision);

  // Resumen POR VENDEDOR (para pagar), consistente con la vista filtrada.
  const resumenVendedor = useMemo(() => {
    const agg = new Map<string, { nombre: string; recibos: number; cobrado: number; comision: number }>();
    for (const r of visibles) {
      const nombre = r.vendedor_nombre ?? "(sin vendedor)";
      const e = agg.get(nombre) ?? { nombre, recibos: 0, cobrado: 0, comision: 0 };
      e.recibos += 1;
      e.cobrado = round2(e.cobrado + r.total);
      e.comision = round2(e.comision + r.comision);
      agg.set(nombre, e);
    }
    return Array.from(agg.values()).sort((a, b) => b.comision - a.comision);
  }, [visibles]);

  // Desglose por vendedor Y por mes (solo con varios meses): matriz de comisión.
  const resumenVendedorMes = useMemo(() => {
    const agg = new Map<string, { nombre: string; porMes: Map<number, number>; total: number }>();
    for (const r of visibles) {
      const nombre = r.vendedor_nombre ?? "(sin vendedor)";
      const e = agg.get(nombre) ?? { nombre, porMes: new Map<number, number>(), total: 0 };
      e.porMes.set(r.mes, round2((e.porMes.get(r.mes) ?? 0) + r.comision));
      e.total = round2(e.total + r.comision);
      agg.set(nombre, e);
    }
    return Array.from(agg.values()).sort((a, b) => b.total - a.total);
  }, [visibles]);

  const periodoLabel = meses.length === 0
    ? "—"
    : meses.map((m) => MESES[m - 1]).join(", ") + ` ${anio}`;

  const exportExcel = async () => {
    if (visibles.length === 0 && formatoB.length === 0) return;
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    // Hoja 1: resumen por vendedor Formato A (todos los meses seleccionados).
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      resumenVendedor.map((v) => ({ Vendedor: v.nombre, Recibos: v.recibos, Cobrado: v.cobrado, Comisión: v.comision })),
    ), "Formato A");
    // Hoja Formato B: venta + cobro (1%).
    if (formatoB.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
        formatoB.map((v) => ({
          Vendedor: v.vendedor,
          Ventas: v.ventas_base, "Com. venta": v.comision_venta,
          Cobros: v.cobros_base, "Com. cobro": v.comision_cobro,
          Total: v.comision_total,
        })),
      ), "Formato B");
    }
    // Con varios meses: hoja adicional con el desglose vendedor × mes.
    if (multi) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
        resumenVendedorMes.map((v) => ({
          Vendedor: v.nombre,
          ...Object.fromEntries(meses.map((m) => [MESES[m - 1], v.porMes.get(m) ?? 0])),
          Total: v.total,
        })),
      ), "Por vendedor y mes");
    }
    // Detalle recibo por recibo del Formato A (con columna Mes si hay varios).
    if (visibles.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
        visibles.map((r) => ({
          ...(multi ? { Mes: MESES[r.mes - 1] } : {}),
          Fecha: r.fecha, Cliente: r.cliente_nombre ?? r.cliente_codigo ?? "",
          Vendedor: r.vendedor_nombre ?? "", Total: r.total, Tasa: r.tasa, Comisión: r.comision,
        })),
      ), "Detalle A");
    }
    const sufijo = meses.map((m) => String(m).padStart(2, "0")).join("_");
    XLSX.writeFile(wb, `Comisiones-${anio}-${sufijo}.xlsx`);
  };

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

  // Opciones de mes del año elegido (sin meses futuros del año en curso).
  const mesOptions: MultiOption[] = useMemo(
    () => MESES.map((m, i) => ({ value: String(i + 1), label: m }))
      .filter((o) => !(anio === cur.y && Number(o.value) > cur.m)),
    [anio, cur.y, cur.m],
  );

  const onAnioChange = (y: number) => {
    setAnio(y);
    if (y === cur.y) {
      // Al volver al año en curso, quitar meses futuros de la selección.
      setMesesSel((prev) => {
        const next = new Set(Array.from(prev).filter((v) => Number(v) <= cur.m));
        return next.size > 0 ? next : new Set([String(cur.m)]);
      });
    }
  };

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
            <div className="w-48">
              <MultiSelect
                label="Meses"
                options={mesOptions}
                selected={mesesSel}
                onChange={setMesesSel}
              />
            </div>
            <select
              value={anio}
              onChange={(e) => onAnioChange(parseInt(e.target.value, 10))}
              className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 min-h-[44px]"
            >
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <button
              onClick={() => setShowFormatos(true)}
              className="px-3 py-2 rounded-xl text-xs font-medium border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-brandit-orange active:scale-[0.97] transition-all min-h-[44px]"
            >
              Formatos
            </button>
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

        {/* Aviso: sin meses seleccionados */}
        {meses.length === 0 && (
          <div className="mb-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
            Selecciona al menos un mes para ver comisiones.
          </div>
        )}

        {/* Aviso multi-mes: vista combinada en vivo + meses que ya tienen cierre */}
        {multi && data && (
          <div className="mb-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 px-4 py-3 text-sm text-blue-700 dark:text-blue-400">
            Vista combinada de {meses.length} meses ({periodoLabel}), calculada en vivo.
            {data.mesesConCierre.length > 0 && (
              <> Los meses {data.mesesConCierre.map((m) => MESES[m - 1]).join(", ")} ya tienen cierre generado; sus cierres no cambian con esta vista.</>
            )}
          </div>
        )}

        {/* KPIs — atenuados mientras carga el mes (no mostrar cifras viejas como si fueran nuevas). */}
        <div className={`grid grid-cols-2 gap-3 mb-5 transition-opacity ${loading ? "opacity-40" : ""}`}>
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
            <p className="text-xs text-gray-400 mb-1">Total cobrado {loading && "· cargando…"}</p>
            <p className="text-2xl font-semibold text-gray-900 dark:text-white tabular-nums">{formatCurrency(totalCobrado)}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4 bg-brandit-orange/5">
            <p className="text-xs text-gray-400 mb-1">Total comisión</p>
            <p className="text-2xl font-semibold text-brandit-orange tabular-nums">{formatCurrency(totalComision)}</p>
          </div>
        </div>

        {/* Tabs Formato A | Formato B (patrón VentasShell) */}
        <div className="flex gap-1 mb-5 border-b border-gray-100 dark:border-gray-800 overflow-x-auto">
          {([
            { key: "A" as const, label: "Formato A" },
            { key: "B" as const, label: "Formato B" },
          ]).map((t) => (
            <button
              key={t.key}
              onClick={() => cambiarTab(t.key)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
                tabFormato === t.key
                  ? "border-brandit-orange text-gray-900 dark:text-white"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Resumen POR VENDEDOR + export Excel */}
        {tabFormato === "A" && !loading && resumenVendedor.length > 0 && (
          <div className="mb-5 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Formato A — comisión por vendedor</p>
                <p className="text-xs text-gray-400">Tramos por recibo: menos de $15,000 → 0.5% · desde $15,000 → 1%</p>
              </div>
              <button
                onClick={() => exportExcel()}
                className="px-3 py-2 rounded-xl text-xs font-medium border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-brandit-orange active:scale-[0.97] transition-all min-h-[44px]"
              >
                Descargar Excel
              </button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100 dark:border-gray-800">
                  <th className="px-4 py-2 font-medium">Vendedor</th>
                  <th className="px-4 py-2 text-right font-medium">Recibos</th>
                  <th className="px-4 py-2 text-right font-medium">Cobrado</th>
                  <th className="px-4 py-2 text-right font-medium">Comisión</th>
                </tr>
              </thead>
              <tbody>
                {resumenVendedor.map((v) => (
                  <tr key={v.nombre} className="border-b border-gray-50 dark:border-gray-800/60 last:border-0">
                    <td className="px-4 py-2.5 text-gray-800 dark:text-gray-200">{v.nombre}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-500">{v.recibos}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{formatCurrency(v.cobrado)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-brandit-orange">{formatCurrency(v.comision)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Formato B — visible solo en su tab (venta + cobro por cartera, 1%) */}
        {tabFormato === "B" && !loading && (
          formatoB.length > 0 ? (
            <FormatoBSection vendedores={formatoB} onVerDetalle={setDetalleBVendedor} />
          ) : (
            <p className="mb-5 py-8 text-center text-sm text-gray-400 border border-dashed border-gray-200 dark:border-gray-800 rounded-2xl">
              No hay vendedores con Formato B. Asígnalos desde el botón Formatos.
            </p>
          )
        )}

        {/* Desglose por vendedor Y por mes (solo con varios meses) */}
        {!loading && multi && resumenVendedorMes.length > 0 && (
          <div className="mb-5 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Comisión por vendedor y mes</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100 dark:border-gray-800">
                    <th className="px-4 py-2 font-medium">Vendedor</th>
                    {meses.map((m) => (
                      <th key={m} className="px-4 py-2 text-right font-medium whitespace-nowrap">{MESES[m - 1].slice(0, 3)}</th>
                    ))}
                    <th className="px-4 py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {resumenVendedorMes.map((v) => (
                    <tr key={v.nombre} className="border-b border-gray-50 dark:border-gray-800/60 last:border-0">
                      <td className="px-4 py-2.5 text-gray-800 dark:text-gray-200 whitespace-nowrap">{v.nombre}</td>
                      {meses.map((m) => (
                        <td key={m} className="px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">
                          {v.porMes.has(m) ? formatCurrency(v.porMes.get(m)!) : "—"}
                        </td>
                      ))}
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-brandit-orange">{formatCurrency(v.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

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
          meses.length === 0 ? null : (
            <div className="py-16 text-center text-sm text-gray-400 border border-dashed border-gray-200 dark:border-gray-800 rounded-2xl">
              Sin recibos {periodoLabel}.
            </div>
          )
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden sm:block overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900 text-left text-xs uppercase tracking-wide text-gray-400">
                    {multi && <th className="px-4 py-2.5 font-medium">Mes</th>}
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
                    <tr key={`${r.mes}-${r.id}`} className="border-t border-gray-100 dark:border-gray-800">
                      {multi && <td className="px-4 py-2.5 whitespace-nowrap text-gray-500 dark:text-gray-400">{MESES[r.mes - 1].slice(0, 3)}</td>}
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
                    <td className="px-4 py-2.5" colSpan={multi ? 4 : 3}>Total ({visibles.length})</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(totalCobradoA)}</td>
                    <td></td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(totalComisionA)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden space-y-2">
              {visibles.map((r) => (
                <div key={`${r.mes}-${r.id}`} className="rounded-2xl border border-gray-200 dark:border-gray-800 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{r.cliente_nombre ?? r.cliente_codigo ?? "-"}</p>
                    <span className="text-xs text-gray-400 shrink-0">{multi ? `${MESES[r.mes - 1].slice(0, 3)} · ` : ""}{fmtDate(r.fecha ?? "")}</span>
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

        {/* Generar — los cierres son mensuales: solo disponible con UN mes seleccionado */}
        {!frozen && meses.length > 0 && (
          <div className="mt-6 flex items-center justify-end gap-3 flex-wrap">
            {multi && (
              <p className="text-xs text-gray-400 text-right">
                Los cierres se generan por mes. Selecciona un solo mes para generar.
              </p>
            )}
            <button
              onClick={() => setConfirmGen(true)}
              disabled={loading || multi || (visibles.length === 0 && formatoB.every((v) => v.ventas_base === 0 && v.cobros_base === 0))}
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
                  onClick={() => { setAnio(h.anio); setMesesSel(new Set([String(h.mes)])); setInitFor(""); window.scrollTo({ top: 0, behavior: "smooth" }); }}
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
        message={`Se congelará el cierre: Formato A ${visibles.length} recibos (${formatCurrency(totalComisionA)})${formatoB.length > 0 ? ` + Formato B ${formatoB.length} vendedor(es) (${formatCurrency(bComision)})` : ""} · comisión total ${formatCurrency(totalComision)}. Podrás eliminarlo para regenerar.`}
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

      {/* Drill-down Formato B */}
      {detalleBVendedor && (
        <DetalleBModal
          anio={anio}
          meses={meses}
          vendedor={detalleBVendedor}
          onClose={() => setDetalleBVendedor(null)}
        />
      )}

      {/* Config de formatos por vendedor */}
      {showFormatos && (
        <FormatosConfigModal
          onClose={() => setShowFormatos(false)}
          onSaved={() => { void load(); }}
        />
      )}
    </div>
  );
}
