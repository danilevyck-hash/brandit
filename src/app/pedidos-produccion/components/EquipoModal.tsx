"use client";

import { Trabajador } from "./types";
import { Modal } from "./ui";

export default function EquipoModal({
  open,
  onClose,
  equipo,
  nuevoTrab,
  setNuevoTrab,
  savingTrab,
  onAdd,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  equipo: Trabajador[];
  nuevoTrab: string;
  setNuevoTrab: (v: string) => void;
  savingTrab: boolean;
  onAdd: () => void;
  onDelete: (t: Trabajador) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Equipo de trabajo">
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={nuevoTrab}
          onChange={(e) => setNuevoTrab(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onAdd();
          }}
          placeholder="Nombre del trabajador"
          className="flex-1 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-brandit-orange transition min-h-[44px]"
        />
        <button
          type="button"
          onClick={onAdd}
          disabled={savingTrab || nuevoTrab.trim() === ""}
          className="px-4 rounded-xl bg-brandit-orange text-white text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50 min-h-[44px]"
        >
          {savingTrab ? "..." : "Añadir"}
        </button>
      </div>

      {equipo.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
          Aún no has agregado a nadie. Empieza por tu equipo de producción.
        </p>
      ) : (
        <div className="space-y-2">
          {equipo.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-xl px-3.5 py-2.5"
            >
              <span className="text-sm text-gray-800 dark:text-gray-200">{t.nombre}</span>
              <button
                type="button"
                onClick={() => onDelete(t)}
                className="text-gray-400 hover:text-red-500 transition p-1"
                aria-label="Borrar trabajador"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
