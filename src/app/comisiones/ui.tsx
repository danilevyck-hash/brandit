"use client";

// UI kit local del módulo Comisiones (patrón Brand It, copia del kit de Caja/
// Recordatorios): Modal + ConfirmModal con createPortal + overlay bg-black/60 +
// animate-fade-in-up + body-scroll-lock + escape-to-close. Más un MultiSelect con
// buscador para los filtros de vendedores/clientes.

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [active]);
}

function useEscapeClose(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [active, onClose]);
}

export function Modal({
  open, onClose, title, children, maxWidth = "max-w-md",
}: { open: boolean; onClose: () => void; title?: string; children: ReactNode; maxWidth?: string }) {
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
          {title && <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">{title}</h2>}
          {children}
        </div>
      </div>
    </>,
    document.body,
  );
}

export function ConfirmModal({
  open, onClose, onConfirm, title = "¿Estás seguro?", message,
  confirmLabel = "Confirmar", cancelLabel = "Cancelar", destructive = false, loading = false,
}: {
  open: boolean; onClose: () => void; onConfirm: () => void; title?: string; message?: string;
  confirmLabel?: string; cancelLabel?: string; destructive?: boolean; loading?: boolean;
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
                  : "bg-brandit-orange text-white hover:opacity-90 active:scale-[0.97]"
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

export interface MultiOption {
  value: string;
  label: string;
}

/**
 * MultiSelect con checkboxes. Todos marcados = "Todos" (el consumidor decide qué
 * mandar al API). Buscador opcional (para clientes). Dropdown con click-outside.
 */
export function MultiSelect({
  label, options, selected, onChange, searchable = false, placeholder = "Buscar...",
}: {
  label: string;
  options: MultiOption[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  searchable?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const filtered = useMemo(() => {
    if (!searchable || !q.trim()) return options;
    const needle = q.trim().toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(needle));
  }, [options, q, searchable]);

  const allSelected = options.length > 0 && options.every((o) => selected.has(o.value));
  const toggle = (v: string) => {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v); else next.add(v);
    onChange(next);
  };
  const toggleAll = () => {
    if (allSelected) onChange(new Set());
    else onChange(new Set(options.map((o) => o.value)));
  };

  const resumen = allSelected
    ? "Todos"
    : selected.size === 0
      ? "Ninguno"
      : `${selected.size} de ${options.length}`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 hover:border-brandit-orange transition-colors min-h-[44px]"
      >
        <span className="truncate"><span className="text-gray-400">{label}:</span> {resumen}</span>
        <svg className={`w-4 h-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-[70] mt-1 w-full min-w-[240px] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl max-h-72 overflow-hidden flex flex-col">
          {searchable && (
            <div className="p-2 border-b border-gray-100 dark:border-gray-800">
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={placeholder}
                className="w-full px-3 py-2 rounded-lg text-sm bg-gray-50 dark:bg-gray-800 outline-none text-gray-700 dark:text-gray-200"
              />
            </div>
          )}
          <button
            type="button"
            onClick={toggleAll}
            className="text-left px-3 py-2 text-xs font-semibold text-brandit-orange hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800"
          >
            {allSelected ? "Quitar todos" : "Seleccionar todos"}
          </button>
          <div className="overflow-y-auto">
            {filtered.length === 0 && <p className="px-3 py-3 text-xs text-gray-400">Sin resultados</p>}
            {filtered.map((o) => (
              <label
                key={o.value}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selected.has(o.value)}
                  onChange={() => toggle(o.value)}
                  className="accent-brandit-orange w-4 h-4"
                />
                <span className="truncate">{o.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
