"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Cliente } from "./types";
import { fmtMoneyCompact } from "@/lib/ventas/format";
import { formatDeltaRatio, type DeltaFormat } from "@/lib/ventas/formatDelta";
import HoverCard from "./HoverCard";

type ApiResponse = {
  rows: Cliente[];
  monthly: Record<string, number[]>;
  error?: string;
};

type SortKey = "nombre" | "ytd" | "delta" | "ultima";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 50;

const TONE_CLASS: Record<DeltaFormat["tone"], string> = {
  emerald: "text-emerald-600",
  orange:  "text-orange-600",
  stone:   "text-gray-400",
};

export default function ClientesView() {
  const [rows, setRows]       = useState<Cliente[] | null>(null);
  const [monthly, setMonthly] = useState<Record<string, number[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const [search, setSearch]   = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("ultima");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage]       = useState(1);

  // Hover state para HoverCard. Delay 300ms para evitar trigger al pasar el mouse.
  const [hovered, setHovered] = useState<{ cliente: Cliente; top: number; left: number } | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleRowEnter = (cliente: Cliente, e: React.MouseEvent<HTMLTableRowElement>) => {
    // Si no hay sparkline data para este codigo (orphan / sin facturas en 12m),
    // ni siquiera schedule — skip silencioso.
    if (!monthly[cliente.id]) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const cardWidth = 288; // w-72 = 18rem
    const gap = 16;
    let left = rect.right + gap;
    if (left + cardWidth > window.innerWidth) {
      // Fallback a la izquierda si no cabe a la derecha.
      left = Math.max(gap, rect.left - cardWidth - gap);
    }
    const top = rect.top;

    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setHovered({ cliente, top, left });
    }, 300);
  };

  const handleRowLeave = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setHovered(null);
  };

  // Fetch on mount. Si vienes del Tab Resumen y volvés acá, no se re-fetcha
  // porque el state persiste (ResumenView/ClientesView mantienen su state
  // mientras VentasShell siga montado).
  useEffect(() => {
    if (rows !== null) return; // ya cargado
    setLoading(true);
    setError(null);
    fetch("/api/ventas/clientes")
      .then(async (res) => {
        const data: ApiResponse = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        setRows(data.rows ?? []);
        setMonthly(data.monthly ?? {});
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Error desconocido");
      })
      .finally(() => setLoading(false));
  }, [rows]);

  // Reset page cuando cambia sort o search.
  useEffect(() => {
    setPage(1);
  }, [sortKey, sortDir, search]);

  // Universe derivado del sort: "ultima" muestra todos los 12m rolling.
  // Cualquier otro sort filtra a YTD strict (ytd > 0).
  const universe = useMemo(() => {
    if (!rows) return [];
    if (sortKey === "ultima") return rows;
    return rows.filter((r) => r.ytd > 0);
  }, [rows, sortKey]);

  // Search por nombre (case-insensitive, sub-string).
  const searched = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return universe;
    return universe.filter((r) => r.nombre.toLowerCase().includes(q));
  }, [universe, search]);

  // Sort.
  const sorted = useMemo(() => {
    const arr = [...searched];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      switch (sortKey) {
        case "nombre":
          return a.nombre.localeCompare(b.nombre) * dir;
        case "ytd":
          return (a.ytd - b.ytd) * dir;
        case "delta":
          return (a.delta - b.delta) * dir;
        case "ultima":
          // Fechas iso o "" si nunca compró. Vacías al final cuando desc.
          if (!a.ultimaIso && !b.ultimaIso) return 0;
          if (!a.ultimaIso) return 1;
          if (!b.ultimaIso) return -1;
          return a.ultimaIso.localeCompare(b.ultimaIso) * dir;
      }
    });
    return arr;
  }, [searched, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageRows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const currentYear = new Date().getFullYear();
  const universeChip = sortKey === "ultima"
    ? { label: "Vista: Últimos 12 meses", bg: "bg-teal-50",   fg: "text-teal-700" }
    : { label: `Vista: YTD ${currentYear}`, bg: "bg-stone-100", fg: "text-stone-700" };

  const sortFieldLabel: Record<SortKey, string> = {
    nombre: "nombre",
    ytd:    "compras YTD",
    delta:  "Δ% vs año anterior",
    ultima: "última compra",
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // Defaults sensatos por columna
      setSortDir(key === "nombre" ? "asc" : "desc");
    }
  };

  const sortArrow = (key: SortKey) =>
    sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  // ─── Render ─────────────────────────────────────────────────────────────
  if (loading && rows === null) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 px-6 py-16 text-center shadow-sm">
        <p className="text-gray-400 text-sm">Cargando clientes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-100 rounded-lg px-6 py-6 text-sm text-red-700">
        Error al cargar clientes: {error}
      </div>
    );
  }

  return (
    <div>
      {/* Chip indicator + search */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${universeChip.bg} ${universeChip.fg}`}>
            {universeChip.label}
          </span>
          <p className="text-xs text-gray-400 mt-1">
            ordenado por {sortFieldLabel[sortKey]} {sortDir === "asc" ? "ascendente" : "descendente"} · {sorted.length} clientes
          </p>
        </div>
        <input
          type="text"
          placeholder="Buscar por nombre..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-72 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-brandit-orange/20 focus:border-brandit-orange/40 outline-none shadow-sm"
        />
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="border-b border-gray-100">
              <th
                onClick={() => handleSort("nombre")}
                className="px-4 py-3 text-left text-xs font-semibold text-gray-500 cursor-pointer select-none hover:text-brandit-orange transition-colors"
              >
                <span className={sortKey === "nombre" ? "text-brandit-orange" : ""}>
                  Cliente{sortArrow("nombre")}
                </span>
              </th>
              <th
                onClick={() => handleSort("ytd")}
                className="px-3 py-3 text-right text-xs font-semibold text-gray-500 cursor-pointer select-none hover:text-brandit-orange transition-colors"
              >
                <span className={sortKey === "ytd" ? "text-brandit-orange" : ""}>
                  Compras YTD{sortArrow("ytd")}
                </span>
              </th>
              <th
                onClick={() => handleSort("delta")}
                className="px-3 py-3 text-right text-xs font-semibold text-gray-500 cursor-pointer select-none hover:text-brandit-orange transition-colors"
              >
                <span className={sortKey === "delta" ? "text-brandit-orange" : ""}>
                  Δ%{sortArrow("delta")}
                </span>
              </th>
              <th
                onClick={() => handleSort("ultima")}
                className="px-3 py-3 text-right text-xs font-semibold text-gray-500 cursor-pointer select-none hover:text-brandit-orange transition-colors"
              >
                <span className={sortKey === "ultima" ? "text-brandit-orange" : ""}>
                  Última compra{sortArrow("ultima")}
                </span>
              </th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500">Contacto</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-gray-400 text-sm">
                  No hay clientes que coincidan
                </td>
              </tr>
            ) : (
              pageRows.map((r) => {
                const delta = formatDeltaRatio(r.delta || null);
                const showDelta = !(delta.arrow === null && delta.displayValue === "—");
                return (
                  <tr
                    key={r.id}
                    onMouseEnter={(e) => handleRowEnter(r, e)}
                    onMouseLeave={handleRowLeave}
                    className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="px-4 py-3 text-gray-900 font-medium">{r.nombre}</td>
                    <td className="px-3 py-3 text-right text-gray-700">{fmtMoneyCompact(r.ytd)}</td>
                    <td className={`px-3 py-3 text-right ${showDelta ? TONE_CLASS[delta.tone] : "text-gray-300"}`}>
                      {showDelta ? (
                        <>
                          {delta.arrow && <span className="mr-1">{delta.arrow}</span>}
                          {delta.displayValue}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-3 text-right text-gray-600">{r.ultima || "—"}</td>
                    <td className="px-3 py-3 text-right">
                      {r.wa ? (
                        <a
                          href={`https://wa.me/${r.wa.replace(/[^\d+]/g, "").replace(/^\+/, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-xs font-medium text-green-600 hover:text-green-700"
                        >
                          WhatsApp
                        </a>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {sorted.length > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            ← Anterior
          </button>
          <p className="text-xs text-gray-500">
            Página {page} de {totalPages}
          </p>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            Siguiente →
          </button>
        </div>
      )}

      {/* HoverCard (desktop only) */}
      {hovered && monthly[hovered.cliente.id] && (
        <HoverCard
          cliente={hovered.cliente}
          monthly={monthly[hovered.cliente.id]}
          style={{ top: hovered.top, left: hovered.left }}
        />
      )}
    </div>
  );
}
