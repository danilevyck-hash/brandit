"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

type ToastType = "success" | "error" | "info";

type Toast = {
  id: string;
  message: string;
  type: ToastType;
};

type ToastContextType = {
  toast: (message: string, type?: ToastType) => void;
};

const ToastContext = createContext<ToastContextType>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

const MAX_TOASTS = 3; // tope de pila: no tapar la pantalla con toasts apilados.

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = "success") => {
    const id = crypto.randomUUID();
    // Los errores necesitan tiempo para leerse/actuar; los éxitos son efímeros.
    const ms = type === "error" ? 7000 : 3000;
    setToasts((prev) => [...prev, { id, message, type }].slice(-MAX_TOASTS));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, ms);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        className="fixed left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-[90vw] max-w-sm pointer-events-none"
        style={{ bottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-start gap-3 px-5 py-3 rounded-2xl shadow-lg text-sm font-medium text-white animate-fade-in-up pointer-events-auto ${
              t.type === "success"
                ? "bg-green-600"
                : t.type === "error"
                ? "bg-red-500"
                : "bg-brandit-black"
            }`}
          >
            <span className="flex-1">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Cerrar"
              className="-mr-1.5 -my-0.5 shrink-0 rounded-lg px-1.5 text-white/70 hover:text-white text-lg leading-none"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
