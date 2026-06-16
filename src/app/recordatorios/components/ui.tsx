"use client";

import { useEffect, ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * UI kit local del módulo Recordatorios de Pago (copia del kit de Caja Menuda).
 * Modal, ConfirmModal, EmptyState, ScrollableTable, SkeletonTable con el patrón
 * Brand It: createPortal + `fixed inset-0 bg-black/60` overlay + panel centrado +
 * `animate-fade-in-up`, con body-scroll lock y escape-to-close.
 */

// ── Body scroll lock (shared by modal-like components) ──
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

// ── Escape-to-close (shared) ──
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
// Provides mobile-friendly horizontal scrolling for wide tables.
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
    document.body
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
    document.body
  );
}
