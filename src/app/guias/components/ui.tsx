"use client";

import { useEffect, useRef, useState, ReactNode } from "react";
import { createPortal } from "react-dom";
import OverflowMenuDefault from "../../caja/components/OverflowMenu";

/**
 * Kit de primitivos UI LOCALES del módulo Guías (Brand It).
 * Reemplaza el barrel `@/components/ui` de fashiongr. Mismos nombres de export
 * y APIs de props que los originales (StatusBadge, AccordionContent, EmptyState,
 * ScrollableTable, SkeletonTable, TimeGroupHeader, Modal, ConfirmModal), pero
 * los modales siguen el patrón Brand It: createPortal + `fixed inset-0
 * bg-black/60` + panel centrado + `animate-fade-in-up`, con bloqueo de scroll.
 * Sin autoFocus, sin slide-up, sin body.position=fixed.
 *
 * PullToRefresh y SwipeableRow son stubs planos (sin gesto) — la fase 2 los
 * sustituye por wrappers planos; aquí solo renderizan children.
 */

// ── Body scroll lock (compartido por modales) ──
function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [active]);
}

// ── Escape-to-close (compartido) ──
function useEscapeClose(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [active, onClose]);
}

// ── Skeleton Loader ──
export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-0">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 py-3 px-4 border-b border-gray-50 dark:border-gray-800">
          {Array.from({ length: cols }).map((_, j) => (
            <div
              key={j}
              className={`h-3 bg-gray-100 dark:bg-gray-800 rounded animate-pulse ${j === 0 ? "w-1/3" : "w-1/5"}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Empty State ──
export function EmptyState({
  icon,
  title = "Nada por aquí aún",
  subtitle,
  actionLabel,
  onAction,
}: {
  icon?: ReactNode;
  title?: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center py-20 text-center">
      <div className="min-w-[48px] min-h-[48px] flex items-center justify-center mb-4">
        {icon || (
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            className="text-gray-200 dark:text-gray-700"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M12 8v4m0 4h.01" />
          </svg>
        )}
      </div>
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{title}</p>
      {subtitle && <p className="text-xs text-gray-400 dark:text-gray-500 mb-4 max-w-xs">{subtitle}</p>}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="text-sm bg-brandit-black text-white px-6 py-2.5 rounded-xl font-medium hover:opacity-90 active:scale-[0.97] transition-all min-h-[44px]"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// ── Scrollable Table Wrapper ──
// Provee scroll horizontal mobile-friendly para tablas anchas.
export function ScrollableTable({
  children,
  minWidth = 700,
  className = "",
}: {
  children: ReactNode;
  minWidth?: number;
  className?: string;
}) {
  return (
    <div className={`overflow-x-auto -mx-4 sm:mx-0 ${className}`}>
      <div className="px-4 sm:px-0" style={{ minWidth: `${minWidth}px` }}>
        {children}
      </div>
    </div>
  );
}

// ── Badge ──
const BADGE_COLORS: Record<string, string> = {
  green: "bg-emerald-50 text-emerald-700",
  yellow: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-700",
  gray: "bg-gray-100 text-gray-500",
  blue: "bg-blue-50 text-blue-700",
  purple: "bg-purple-50 text-purple-700",
  orange: "bg-orange-50 text-orange-700",
};

export function Badge({
  children,
  color = "gray",
}: {
  children: ReactNode;
  color?: keyof typeof BADGE_COLORS | string;
}) {
  const cls = BADGE_COLORS[color] || BADGE_COLORS.gray;
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium inline-flex items-center ${cls}`}>
      {children}
    </span>
  );
}

// ── Status Badge (estado → color) ──
const STATUS_COLORS: Record<string, string> = {
  pendiente: "yellow",
  borrador: "yellow",
  Borrador: "yellow",
  pendiente_aprobacion: "yellow",
  activo: "green",
  abierto: "green",
  Enviado: "blue",
  depositado: "green",
  aprobado: "green",
  Aplicado: "green",
  Pagado: "green",
  cerrado: "gray",
  Aplicada: "green",
  Entregado: "green",
  despachada: "green",
  Completada: "green",
  rechazado: "red",
  Rechazado: "red",
  Rechazada: "red",
  vencido: "red",
  rebotado: "red",
  archivado: "red",
  Confirmado: "purple",
  "En revisión": "purple",
  Preparando: "orange",
  "En camino": "orange",
};

export function StatusBadge({ estado }: { estado: string }) {
  const color = STATUS_COLORS[estado] || "gray";
  const [animate, setAnimate] = useState(false);
  const prevEstado = useRef(estado);

  useEffect(() => {
    if (prevEstado.current !== estado) {
      setAnimate(true);
      prevEstado.current = estado;
      const t = setTimeout(() => setAnimate(false), 220);
      return () => clearTimeout(t);
    }
  }, [estado]);

  return (
    <span className={animate ? "badge-enter inline-flex" : "inline-flex"}>
      <Badge color={color}>{estado}</Badge>
    </span>
  );
}

// ── Animated Accordion Content ──
// Truco CSS grid: grid-rows-[0fr] → grid-rows-[1fr] para animar altura.
export function AccordionContent({
  open,
  children,
  className = "",
  duration = 250,
}: {
  open: boolean;
  children: ReactNode;
  className?: string;
  duration?: number;
}) {
  return (
    <div
      className={`grid transition-[grid-template-rows] ease-out ${className}`}
      style={{
        gridTemplateRows: open ? "1fr" : "0fr",
        transitionDuration: `${duration}ms`,
      }}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}

// ── Time Group Header (header colapsable por período) ──
export function TimeGroupHeader({
  label,
  count,
  color,
  bgColor: _bgColor,
  defaultOpen = true,
  children,
}: {
  label: string;
  count: number;
  color: string;
  bgColor: string;
  defaultOpen?: boolean;
  children: ReactNode;
  /** Número de columnas que abarca el header (contextos de tabla) */
  colSpan?: number;
  /** Render como fila de tabla en vez de div */
  asTableRow?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="sticky top-14 z-[5] w-full flex items-center gap-3 px-4 py-2 text-left transition-colors bg-gray-50/90 backdrop-blur-sm border-b border-gray-200"
      >
        <svg
          className={`w-3 h-3 ${color} transition-transform shrink-0 ${open ? "rotate-90" : ""}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M6 4l8 6-8 6V4z" />
        </svg>
        <span className={`text-sm font-semibold ${color}`}>{label}</span>
        <span className="text-[11px] text-gray-400 tabular-nums">
          ({count} {count === 1 ? "guía" : "guías"})
        </span>
      </button>
      {open && children}
    </div>
  );
}

// ── Modal ──
export function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = "max-w-md",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  maxWidth?: string;
}) {
  useBodyScrollLock(open);
  useEscapeClose(open, onClose);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      <div className="fixed inset-0 bg-black/60 z-[80]" onClick={onClose} />
      <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
        <div
          className={`bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full ${maxWidth} p-6 border border-gray-200 dark:border-gray-700 max-h-[90vh] overflow-y-auto animate-fade-in-up`}
          onClick={(e) => e.stopPropagation()}
        >
          {title && (
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">{title}</h2>
          )}
          {children}
        </div>
      </div>
    </>,
    document.body,
  );
}

// ── Confirm Modal ──
export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title = "¿Estás seguro?",
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  destructive = false,
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
}) {
  useBodyScrollLock(open);
  useEscapeClose(open, onClose);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      <div className="fixed inset-0 bg-black/60 z-[80]" onClick={onClose} />
      <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
        <div
          className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-gray-200 dark:border-gray-700 animate-fade-in-up"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">{title}</h3>
          {message && <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{message}</p>}
          <div className="flex gap-3 mt-4">
            <button
              onClick={onConfirm}
              disabled={loading}
              className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50 min-h-[44px] ${
                destructive
                  ? "bg-red-600 text-white hover:bg-red-700 active:scale-[0.97]"
                  : "bg-brandit-black text-white hover:opacity-90 active:scale-[0.97]"
              }`}
            >
              {loading ? "Procesando..." : confirmLabel}
            </button>
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 px-4 py-2.5 rounded-xl text-sm hover:bg-gray-50 dark:hover:bg-gray-800 active:bg-gray-100 transition-all disabled:opacity-50 min-h-[44px]"
            >
              {cancelLabel}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}

// ── OverflowMenu (re-export del kebab "···" de Brand It) ──
export { default as OverflowMenu } from "../../caja/components/OverflowMenu";
export type { OverflowMenuItem } from "../../caja/components/OverflowMenu";
// Alias para que el barrel también lo provea como referencia interna si hiciera falta.
export const OverflowMenuComponent = OverflowMenuDefault;

// ── Mobile niceties: STUBS planos ──
// La fase 2 los sustituye por wrappers planos. Aquí no implementan gesto:
// solo renderizan children.

export interface SwipeAction {
  label: string;
  icon?: ReactNode;
  color: string; // Tailwind bg class e.g. "bg-emerald-500"
  textColor?: string; // defaults to "text-white"
  onAction: () => void;
}

export function SwipeableRow({
  children,
  className = "",
}: {
  children: ReactNode;
  leftAction?: SwipeAction; // ignorado en el stub
  rightAction?: SwipeAction; // ignorado en el stub
  className?: string;
  threshold?: number;
  executeThreshold?: number;
}) {
  return <div className={className}>{children}</div>;
}

export function PullToRefresh({
  onRefresh,
  children,
}: {
  onRefresh?: () => void | Promise<void>;
  children: ReactNode;
}) {
  const THRESHOLD = 70;   // px de pull (ya con resistencia) para disparar refresh
  const MAX = 110;        // tope visual del pull

  const containerRef = useRef<HTMLDivElement>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  // Refs espejo para leer dentro de los listeners sin re-suscribir en cada frame.
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);
  const startY = useRef<number | null>(null);
  const active = useRef(false);

  const applyPull = (v: number) => { pullRef.current = v; setPull(v); };
  const setRefreshingBoth = (v: boolean) => { refreshingRef.current = v; setRefreshing(v); };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onStart = (e: TouchEvent) => {
      if (refreshingRef.current) return;
      // Solo arranca el gesto si el scroll está en el tope.
      if (window.scrollY > 0) { startY.current = null; return; }
      startY.current = e.touches[0].clientY;
      active.current = false;
    };
    const onMove = (e: TouchEvent) => {
      if (refreshingRef.current || startY.current === null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0 || window.scrollY > 0) {
        if (active.current) { active.current = false; applyPull(0); }
        return;
      }
      active.current = true;
      applyPull(Math.min(MAX, dy * 0.5));   // resistencia: la mitad del arrastre
      if (e.cancelable) e.preventDefault();  // frena el scroll/bounce nativo mientras se tira
    };
    const onEnd = () => {
      if (refreshingRef.current || startY.current === null) return;
      const shouldRefresh = active.current && pullRef.current >= THRESHOLD;
      startY.current = null;
      active.current = false;
      if (shouldRefresh && onRefresh) {
        setRefreshingBoth(true);
        applyPull(46);  // deja espacio para el spinner mientras refresca
        Promise.resolve(onRefresh()).finally(() => {
          setRefreshingBoth(false);
          applyPull(0);
        });
      } else {
        applyPull(0);
      }
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [onRefresh]);

  const ready = pull >= THRESHOLD;

  return (
    <div ref={containerRef} style={{ overscrollBehaviorY: "contain" }}>
      {/* Indicador: crece con el pull y empuja el contenido hacia abajo */}
      <div
        className="flex items-center justify-center overflow-hidden text-xs text-gray-400 select-none"
        style={{ height: pull, transition: active.current ? "none" : "height 200ms ease" }}
        aria-hidden
      >
        {refreshing ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Actualizando...
          </span>
        ) : pull > 0 ? (
          <span>{ready ? "Soltá para refrescar" : "Tirá para refrescar"}</span>
        ) : null}
      </div>
      {children}
    </div>
  );
}
