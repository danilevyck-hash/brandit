"use client";

import { useState, useEffect, useCallback } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";

type CxcRow = {
  id: string;
  codigo: string;
  nombre: string;
  nombre_normalized: string;
  d_0_30: number;
  d_31_60: number;
  d_61_90: number;
  d_91_120: number;
  d_121_180: number;
  d_181_270: number;
  d_271_365: number;
  d_mas_365: number;
  total: number;
  override_notas: string | null;
  override_estado: string | null;
};

type Upload = {
  id: string;
  uploaded_at: string;
  filename: string;
};

type SortKey = "nombre" | "d_0_30" | "d_31_60" | "d_61_90" | "plus90" | "total";
type SortDir = "asc" | "desc";

const JUNK_CODIGOS = new Set(["0-30", "31-60", "61-90", "91-120", "121-180", "181-270", "271-365", "MAS DE 365", "TOTAL"]);

function isValidClientName(nombre: string | undefined | null): boolean {
  if (!nombre) return false;
  const trimmed = nombre.trim();
  if (trimmed.length === 0) return false;
  if (!isNaN(Number(trimmed))) return false;
  return true;
}

function normalizeName(name: string): string {
  return name.toUpperCase().replace(/[.,]/g, "").trim();
}

function parseNum(val: string | undefined | null): number {
  if (!val) return 0;
  const cleaned = String(val).replace(/,/g, "").replace(/\s/g, "").trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function normalizeHeader(h: string): string {
  return h.trim().replace(/\s+/g, " ").toUpperCase();
}

function get90Plus(row: CxcRow): number {
  return Number(row.d_91_120) + Number(row.d_121_180) + Number(row.d_181_270) + Number(row.d_271_365) + Number(row.d_mas_365);
}

function getClientStatus(row: CxcRow): "corriente" | "vigilancia" | "vencido" {
  const vencido = Number(row.d_121_180) + Number(row.d_181_270) + Number(row.d_271_365) + Number(row.d_mas_365);
  if (vencido > 0) return "vencido";
  const vigilancia = Number(row.d_91_120);
  if (vigilancia > 0) return "vigilancia";
  return "corriente";
}

const STATUS_COLORS = {
  corriente: { bg: "bg-green-50", text: "text-green-600", label: "Corriente" },
  vigilancia: { bg: "bg-yellow-50", text: "text-yellow-600", label: "Vigilancia" },
  vencido: { bg: "bg-red-50", text: "text-red-600", label: "Vencido" },
};

export default function CxcPage() {
  const [rows, setRows] = useState<CxcRow[]>([]);
  const [upload, setUpload] = useState<Upload | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"tabla" | "cards">("tabla");
  const [uploading, setUploading] = useState(false);
  const [role, setRole] = useState("");
  const [sort, setSort] = useState<SortKey>("nombre");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [favoritos, setFavoritos] = useState<string[]>([]);
  const [showFavs, setShowFavs] = useState(false);

  const handleSort = (key: SortKey) => {
    if (sort === key) {
      setSortDir((d) => d === "asc" ? "desc" : "asc");
    } else {
      setSort(key);
      setSortDir(key === "nombre" ? "asc" : "desc");
    }
  };

  const sortArrow = (key: SortKey) => sort === key ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  useEffect(() => {
    setRole(localStorage.getItem("brandit_role") || "");
    try {
      const saved = localStorage.getItem("cxc_favoritos");
      if (saved) setFavoritos(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  const toggleFav = (nombre: string) => {
    setFavoritos((prev) => {
      const next = prev.includes(nombre) ? prev.filter((f) => f !== nombre) : [...prev, nombre];
      localStorage.setItem("cxc_favoritos", JSON.stringify(next));
      return next;
    });
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cxc", { cache: "no-store" });
      const data = await res.json();
      const clean = (data.rows || []).filter((r: CxcRow) =>
        isValidClientName(r.nombre) && !JUNK_CODIGOS.has((r.nombre || "").trim().toUpperCase()) && Number(r.total) > 0
      );
      setRows(clean);
      setUpload(data.upload || null);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const canUpload = role === "admin" || role === "secretaria";

  const handleExportExcel = () => {
    const cleanRows = filtered.filter((r) => isValidClientName(r.nombre) && !JUNK_CODIGOS.has((r.codigo || "").trim().toUpperCase()));
    const exportRows = cleanRows.map((r) => ({
      "Código": r.codigo || "",
      "Cliente": r.nombre,
      "0-30": Number(r.d_0_30),
      "31-60": Number(r.d_31_60),
      "61-90": Number(r.d_61_90),
      "90+": get90Plus(r),
      "Total": Number(r.total),
      "Estado": getClientStatus(r) === "corriente" ? "Corriente" : getClientStatus(r) === "vigilancia" ? "Vigilancia" : "Vencido",
    }));
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "CxC");
    const today = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `cxc_confecciones_boston_${today}.xlsx`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    Papa.parse(file, {
      delimiter: ";",
      header: true,
      encoding: "latin1",
      complete: async (results) => {
        const originalFields = results.meta.fields || [];
        const normalizedToOriginal: Record<string, string> = {};
        originalFields.forEach((f) => {
          normalizedToOriginal[normalizeHeader(f)] = f;
        });

        const parsed = (results.data as Record<string, string>[])
          .filter((row) => {
            const origKey = normalizedToOriginal["NOMBRE"] || "NOMBRE";
            const nombre = row[origKey];
            if (!isValidClientName(nombre)) return false;
            const codigoKey = normalizedToOriginal["CODIGO"] || "CODIGO";
            const codigo = (row[codigoKey] || "").trim().toUpperCase();
            if (JUNK_CODIGOS.has(codigo)) return false;
            return true;
          })
          .map((row) => {
            const get = (normalizedKey: string): string => {
              const origKey = normalizedToOriginal[normalizedKey];
              if (origKey && row[origKey] !== undefined) return row[origKey];
              return "";
            };
            const nombre = get("NOMBRE").trim();
            return {
              codigo: get("CODIGO"),
              nombre,
              nombre_normalized: normalizeName(nombre),
              correo: get("CORREO"),
              telefono: get("TELEFONO"),
              celular: get("CELULAR"),
              contacto: get("CONTACTO"),
              pais: get("PAIS"),
              provincia: get("PROVINCIA"),
              distrito: get("DISTRITO"),
              corregimiento: get("CORREGIMIENTO"),
              limite_credito: parseNum(get("LIMITE CREDITO")),
              limite_morosidad: parseNum(get("LIMITE MOROSIDAD")),
              d_0_30: parseNum(get("0-30")),
              d_31_60: parseNum(get("31-60")),
              d_61_90: parseNum(get("61-90")),
              d_91_120: parseNum(get("91-120")),
              d_121_180: parseNum(get("121-180")),
              d_181_270: parseNum(get("181-270")),
              d_271_365: parseNum(get("271-365")),
              d_mas_365: parseNum(get("MAS DE 365")),
              total: parseNum(get("TOTAL")),
            };
          });

        if (parsed.length === 0) {
          alert("No se encontraron datos válidos en el CSV");
          setUploading(false);
          return;
        }

        const res = await fetch("/api/cxc/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: parsed, filename: file.name }),
        });
        const data = await res.json();
        if (!res.ok) {
          alert(data.error || `Error del servidor: ${res.status}`);
        } else if (data.error) {
          alert(data.error);
        } else if (data.success) {
          alert(`Cargado exitosamente: ${data.count} clientes`);
          loadData();
        } else {
          loadData();
        }
        setUploading(false);
      },
      error: () => {
        alert("Error al leer el archivo CSV");
        setUploading(false);
      },
    });

    e.target.value = "";
  };

  // Filter
  const searched = rows.filter((r) =>
    !search || (r.nombre || "").toLowerCase().includes(search.toLowerCase())
  );

  const favsFiltered = showFavs ? searched.filter((r) => favoritos.includes(r.nombre)) : searched;

  // Sort
  const sorted = [...favsFiltered].sort((a, b) => {
    if (showFavs) {
      const aFav = favoritos.includes(a.nombre) ? 0 : 1;
      const bFav = favoritos.includes(b.nombre) ? 0 : 1;
      if (aFav !== bFav) return aFav - bFav;
    }
    const dir = sortDir === "asc" ? 1 : -1;
    if (sort === "nombre") return (a.nombre || "").localeCompare(b.nombre || "") * dir;
    if (sort === "plus90") return (get90Plus(a) - get90Plus(b)) * dir;
    const aVal = Number((a as Record<string, unknown>)[sort]) || 0;
    const bVal = Number((b as Record<string, unknown>)[sort]) || 0;
    return (aVal - bVal) * dir;
  });

  const filtered = sorted;

  const fmt = (n: number) =>
    new Intl.NumberFormat("es-PA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n));

  const totals = filtered.reduce(
    (acc, r) => ({
      d_0_30: acc.d_0_30 + Number(r.d_0_30),
      d_31_60: acc.d_31_60 + Number(r.d_31_60),
      d_61_90: acc.d_61_90 + Number(r.d_61_90),
      plus90: acc.plus90 + get90Plus(r),
      total: acc.total + Number(r.total),
    }),
    { d_0_30: 0, d_31_60: 0, d_61_90: 0, plus90: 0, total: 0 }
  );

  const getFreshness = () => {
    if (!upload) return null;
    const days = Math.floor((Date.now() - new Date(upload.uploaded_at).getTime()) / (1000 * 60 * 60 * 24));
    if (days <= 7) return { color: "bg-green-500", label: `Actualizado hace ${days}d` };
    if (days <= 15) return { color: "bg-yellow-500", label: `Hace ${days} días` };
    return { color: "bg-red-500", label: `Hace ${days} días` };
  };

  const freshness = getFreshness();

  const formatUploadDate = (d: string) =>
    new Date(d).toLocaleDateString("es-PA", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-4xl font-extrabold text-brandit-black tracking-tight">Cuentas por Cobrar</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-sm text-gray-400">Antigüedad de saldos</p>
            {freshness && (
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className={`w-2 h-2 rounded-full ${freshness.color}`}></span>
                {freshness.label}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setView("tabla")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === "tabla" ? "bg-white text-brandit-black shadow-sm" : "text-gray-500"}`}>
              Tabla
            </button>
            <button onClick={() => setView("cards")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === "cards" ? "bg-white text-brandit-black shadow-sm" : "text-gray-500"}`}>
              Cards
            </button>
          </div>
          {canUpload && (
            <>
              <button
                onClick={handleExportExcel}
                disabled={rows.length === 0}
                className="bg-white border border-gray-200 text-brandit-black font-semibold px-6 py-3 rounded-xl text-sm hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50 disabled:pointer-events-none"
              >
                Exportar Excel
              </button>
              <label className={`bg-brandit-orange text-white font-semibold px-6 py-3 rounded-xl text-sm hover:bg-brandit-orange/90 transition-colors shadow-sm cursor-pointer ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
                {uploading ? "Cargando..." : "Cargar CSV"}
                <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
              </label>
            </>
          )}
        </div>
      </div>

      {/* Last upload info */}
      {canUpload && upload && (
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-2.5 text-xs text-gray-600">
            <span className="font-medium">Última carga:</span>
            <span>{formatUploadDate(upload.uploaded_at)}</span>
            <span className="text-gray-300">·</span>
            <span>{upload.filename}</span>
            <span className="text-gray-300">·</span>
            <span>{rows.length} clientes</span>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="mb-4">
        <input
          placeholder="Buscar por nombre de cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brandit-orange/20 focus:border-brandit-orange/40 outline-none shadow-sm"
        />
      </div>

      {/* Favoritos filter */}
      {rows.length > 0 && (
        <div className="flex items-center gap-2 mb-6">
          <button onClick={() => setShowFavs(!showFavs)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              showFavs ? "bg-brandit-orange text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}>
            ★ Favoritos
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-24 text-gray-300 text-lg">Cargando...</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-24">
          <p className="text-gray-400 text-lg mb-3">No hay datos de CxC</p>
          {canUpload && <p className="text-gray-400 text-sm">Cargue un archivo CSV para comenzar</p>}
        </div>
      ) : view === "tabla" ? (
        <div className="bg-white rounded-2xl border border-gray-50 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left">
                <th className="px-4 py-3 text-xs font-semibold whitespace-nowrap cursor-pointer select-none hover:text-brandit-orange transition-colors" onClick={() => handleSort("nombre")}>
                  <span className={sort === "nombre" ? "text-brandit-orange" : "text-brandit-black"}>Cliente{sortArrow("nombre")}</span>
                </th>
                <th className="px-3 py-3 text-xs font-semibold text-right whitespace-nowrap cursor-pointer select-none hover:text-brandit-orange transition-colors" onClick={() => handleSort("d_0_30")}>
                  <span className={sort === "d_0_30" ? "text-brandit-orange" : "text-brandit-black"}>0-30{sortArrow("d_0_30")}</span>
                </th>
                <th className="px-3 py-3 text-xs font-semibold text-right whitespace-nowrap cursor-pointer select-none hover:text-brandit-orange transition-colors" onClick={() => handleSort("d_31_60")}>
                  <span className={sort === "d_31_60" ? "text-brandit-orange" : "text-brandit-black"}>31-60{sortArrow("d_31_60")}</span>
                </th>
                <th className="px-3 py-3 text-xs font-semibold text-right whitespace-nowrap cursor-pointer select-none hover:text-brandit-orange transition-colors" onClick={() => handleSort("d_61_90")}>
                  <span className={sort === "d_61_90" ? "text-brandit-orange" : "text-brandit-black"}>61-90{sortArrow("d_61_90")}</span>
                </th>
                <th className="px-3 py-3 text-xs font-semibold text-right whitespace-nowrap cursor-pointer select-none hover:text-brandit-orange transition-colors" onClick={() => handleSort("plus90")}>
                  <span className={sort === "plus90" ? "text-brandit-orange" : "text-red-600"}>90+{sortArrow("plus90")}</span>
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-right whitespace-nowrap cursor-pointer select-none hover:text-brandit-orange transition-colors" onClick={() => handleSort("total")}>
                  <span className={sort === "total" ? "text-brandit-orange" : "text-brandit-black"}>Total{sortArrow("total")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const status = getClientStatus(r);
                const p90 = get90Plus(r);
                const isFav = favoritos.includes(r.nombre);
                return (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors duration-100">
                    <td className="px-4 py-3 text-gray-900 font-medium">
                      <div className="flex items-center gap-2">
                        <button onClick={() => toggleFav(r.nombre)} className={`text-sm flex-shrink-0 ${isFav ? "text-brandit-orange" : "text-gray-300 hover:text-gray-400"}`}>★</button>
                        <span className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: status === "corriente" ? "#22c55e" : status === "vigilancia" ? "#eab308" : "#ef4444" }}
                        ></span>
                        {r.nombre}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right text-gray-600 tabular-nums">{Number(r.d_0_30) ? fmt(r.d_0_30) : "-"}</td>
                    <td className="px-3 py-3 text-right text-gray-600 tabular-nums">{Number(r.d_31_60) ? fmt(r.d_31_60) : "-"}</td>
                    <td className="px-3 py-3 text-right text-gray-600 tabular-nums">{Number(r.d_61_90) ? fmt(r.d_61_90) : "-"}</td>
                    <td className={`px-3 py-3 text-right tabular-nums font-semibold ${p90 > 0 ? "text-red-600" : "text-gray-600"}`}>{p90 > 0 ? fmt(p90) : "-"}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900 tabular-nums">{fmt(r.total)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-brandit-orange font-bold text-brandit-black">
                <td className="px-4 py-3">Totales ({filtered.length})</td>
                <td className="px-3 py-3 text-right tabular-nums">{fmt(totals.d_0_30)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{fmt(totals.d_31_60)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{fmt(totals.d_61_90)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-red-600">{fmt(totals.plus90)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{fmt(totals.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((r) => {
            const status = getClientStatus(r);
            const sc = STATUS_COLORS[status];
            const p90 = get90Plus(r);
            const isFav = favoritos.includes(r.nombre);
            return (
              <div key={r.id} className="bg-white rounded-2xl border border-gray-50 p-5 hover:shadow-md transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleFav(r.nombre)} className={`text-sm flex-shrink-0 ${isFav ? "text-brandit-orange" : "text-gray-300 hover:text-gray-400"}`}>★</button>
                    <h3 className="font-semibold text-gray-900 text-sm leading-tight">{r.nombre}</h3>
                  </div>
                  <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${sc.bg} ${sc.text} flex-shrink-0 ml-2`}>
                    {sc.label}
                  </span>
                </div>
                <p className="text-2xl font-bold text-brandit-black mb-3">${fmt(r.total)}</p>
                <div className="grid grid-cols-4 gap-1 text-[10px]">
                  {Number(r.d_0_30) > 0 && <div className="text-center"><p className="text-gray-400">0-30</p><p className="font-semibold text-gray-600">{fmt(r.d_0_30)}</p></div>}
                  {Number(r.d_31_60) > 0 && <div className="text-center"><p className="text-gray-400">31-60</p><p className="font-semibold text-gray-600">{fmt(r.d_31_60)}</p></div>}
                  {Number(r.d_61_90) > 0 && <div className="text-center"><p className="text-gray-400">61-90</p><p className="font-semibold text-gray-600">{fmt(r.d_61_90)}</p></div>}
                  {p90 > 0 && <div className="text-center"><p className="text-red-500">90+</p><p className="font-semibold text-red-600">{fmt(p90)}</p></div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
