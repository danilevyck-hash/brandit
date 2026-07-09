"use client";

import { PedidoProduccion, Trabajador, TIPOS, ESTADOS, tipoStyle } from "./types";
import { EmptyState, SkeletonTable } from "./ui";
import type { Vista } from "../hooks/usePedidosState";

// "Hoy" en Panamá (UTC-5 todo el año, sin DST) como YYYY-MM-DD.
export function hoyPanama(): string {
  return new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
}

// fecha es YYYY-MM-DD; formatear sin construir Date (evita corrimiento por TZ).
function fmtFecha(fecha: string): string {
  const [y, m, d] = fecha.split("-");
  if (!y || !m || !d) return fecha;
  return `${d}/${m}`;
}

// ── Pill de estado (clic = ciclar) ──
function EstadoPill({ estado, onClick }: { estado: string; onClick: (e: React.MouseEvent) => void }) {
  const c = ESTADOS[estado] || ESTADOS.Pendiente;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ background: c.bg, color: c.text }}
      className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full active:scale-95 transition whitespace-nowrap"
    >
      <span style={{ background: c.text }} className="w-1.5 h-1.5 rounded-full" />
      {estado}
    </button>
  );
}

function ChevronUp() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}
function ChevronDown() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// ── Vista cola general: lista reordenable con flechas + posición ──
function ColaGeneral({
  visibles,
  total,
  pedidosFull,
  onMover,
  onEstado,
  onEdit,
  onDelete,
}: {
  visibles: PedidoProduccion[];
  total: number;
  pedidosFull: PedidoProduccion[];
  onMover: (id: string, dir: -1 | 1) => void;
  onEstado: (p: PedidoProduccion) => void;
  onEdit: (p: PedidoProduccion) => void;
  onDelete: (p: PedidoProduccion) => void;
}) {
  if (visibles.length === 0) {
    return <p className="text-center text-gray-400 text-sm py-10">No hay pedidos de este tipo.</p>;
  }

  return (
    <div className="space-y-2.5">
      {visibles.map((p) => {
        const idx = pedidosFull.findIndex((x) => x.id === p.id);
        const t = tipoStyle(p.tipo);
        const listo = p.estado === "Listo";
        return (
          <div
            key={p.id}
            className={`bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex items-stretch overflow-hidden transition ${
              listo ? "opacity-60" : ""
            }`}
          >
            {/* Controles de orden */}
            <div className="flex flex-col items-center justify-center px-2.5 bg-gray-50/60 dark:bg-gray-800/40 border-r border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => onMover(p.id, -1)}
                disabled={idx === 0}
                className="text-gray-400 disabled:opacity-25 hover:text-gray-700 dark:hover:text-gray-200 transition min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Subir"
              >
                <ChevronUp />
              </button>
              <span className="text-xs font-semibold text-gray-400 tabular-nums">{idx + 1}</span>
              <button
                type="button"
                onClick={() => onMover(p.id, 1)}
                disabled={idx === total - 1}
                className="text-gray-400 disabled:opacity-25 hover:text-gray-700 dark:hover:text-gray-200 transition min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Bajar"
              >
                <ChevronDown />
              </button>
            </div>

            {/* Cuerpo */}
            <div className="flex-1 py-3 px-3.5 min-w-0">
              <p className="text-base font-semibold text-gray-900 dark:text-white truncate">
                {p.cliente || "Sin cliente"}
              </p>
              <div className="flex items-center gap-2 flex-wrap mt-1.5">
                <span
                  style={{ background: t.bg, color: t.text }}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
                >
                  <span style={{ background: t.dot }} className="w-2 h-2 rounded-full" />
                  {p.tipo}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{p.trabajador || "Sin asignar"}</span>
                {p.fecha_entrega && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">· entrega {fmtFecha(p.fecha_entrega)}</span>
                )}
              </div>
              {p.notas && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5 truncate">{p.notas}</p>}
            </div>

            {/* Estado + acciones */}
            <div className="flex flex-col items-end justify-between py-3 px-3 gap-2">
              <EstadoPill estado={p.estado} onClick={() => onEstado(p)} />
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onEdit(p)}
                  className="text-gray-300 hover:text-gray-600 dark:hover:text-gray-200 transition min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label="Editar"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(p)}
                  className="text-gray-300 hover:text-red-500 transition min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label="Borrar"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Vistas agrupadas (por trabajador / por tipo) ──
function Agrupado({
  pedidos,
  grupos,
  campo,
  onEstado,
  onEdit,
}: {
  pedidos: PedidoProduccion[];
  grupos: string[];
  campo: "trabajador" | "tipo";
  onEstado: (p: PedidoProduccion) => void;
  onEdit: (p: PedidoProduccion) => void;
}) {
  const conPedidos = grupos
    .map((g) => ({
      grupo: g,
      items: pedidos.filter((p) => (p[campo] || "Sin asignar") === g),
    }))
    .filter((x) => x.items.length > 0);

  if (conPedidos.length === 0) {
    return <p className="text-center text-gray-400 text-sm py-10">Sin pedidos para mostrar.</p>;
  }

  return (
    <div className="space-y-6">
      {conPedidos.map(({ grupo, items }) => {
        const t = campo === "tipo" ? tipoStyle(grupo) : null;
        return (
          <div key={grupo}>
            <div className="flex items-center gap-2 mb-2.5 px-1">
              {t && <span style={{ background: t.dot }} className="w-2.5 h-2.5 rounded-full" />}
              <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{grupo}</h2>
              <span className="text-xs text-gray-400">{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.map((p) => {
                const tt = tipoStyle(p.tipo);
                const listo = p.estado === "Listo";
                return (
                  <div
                    key={p.id}
                    onClick={() => onEdit(p)}
                    className={`bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 px-4 py-3 flex items-center justify-between gap-3 cursor-pointer hover:border-gray-200 dark:hover:border-gray-700 transition ${
                      listo ? "opacity-60" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {p.cliente || "Sin cliente"}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {campo === "trabajador" ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span style={{ background: tt.dot }} className="w-2 h-2 rounded-full" />
                            {p.tipo}
                          </span>
                        ) : (
                          <span>{p.trabajador || "Sin asignar"}</span>
                        )}
                        {p.fecha_entrega && <span className="text-gray-400 dark:text-gray-500">· {fmtFecha(p.fecha_entrega)}</span>}
                      </div>
                    </div>
                    <EstadoPill
                      estado={p.estado}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEstado(p);
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function PedidoList({
  pedidos,
  equipo,
  loading,
  vista,
  filtroTipo,
  onNuevo,
  onMover,
  onEstado,
  onEdit,
  onDelete,
}: {
  pedidos: PedidoProduccion[];
  equipo: Trabajador[];
  loading: boolean;
  vista: Vista;
  filtroTipo: string;
  onNuevo: () => void;
  onMover: (id: string, dir: -1 | 1) => void;
  onEstado: (p: PedidoProduccion) => void;
  onEdit: (p: PedidoProduccion) => void;
  onDelete: (p: PedidoProduccion) => void;
}) {
  if (loading) return <SkeletonTable rows={5} cols={4} />;

  if (pedidos.length === 0) {
    return (
      <EmptyState
        title="Aún no hay pedidos"
        subtitle="Agrega tu primer pedido para empezar a organizar la producción del taller."
        actionLabel="Nuevo pedido"
        onAction={onNuevo}
      />
    );
  }

  if (vista === "cola") {
    const visibles = filtroTipo === "Todos" ? pedidos : pedidos.filter((p) => p.tipo === filtroTipo);
    return (
      <ColaGeneral
        visibles={visibles}
        total={pedidos.length}
        pedidosFull={pedidos}
        onMover={onMover}
        onEstado={onEstado}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );
  }

  if (vista === "trabajador") {
    const grupos = [...equipo.map((t) => t.nombre), "Sin asignar"];
    return <Agrupado pedidos={pedidos} grupos={grupos} campo="trabajador" onEstado={onEstado} onEdit={onEdit} />;
  }

  // vista === "tipo"
  const grupos = TIPOS.map((t) => t.name);
  return <Agrupado pedidos={pedidos} grupos={grupos} campo="tipo" onEstado={onEstado} onEdit={onEdit} />;
}
