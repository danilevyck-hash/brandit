"use client";

import { usePedidosAuth } from "./hooks/usePedidosAuth";
import { usePedidosState } from "./hooks/usePedidosState";
import PedidoList from "./components/PedidoList";
import PedidoForm from "./components/PedidoForm";
import EquipoModal from "./components/EquipoModal";
import { Modal, ConfirmModal } from "./components/ui";
import { TIPOS } from "./components/types";

const VISTAS: [string, string][] = [
  ["cola", "Orden general"],
  ["trabajador", "Por trabajador"],
  ["tipo", "Por tipo"],
];

export default function PedidosProduccionPage() {
  const { authChecked } = usePedidosAuth();
  const s = usePedidosState();

  if (!authChecked) return null;

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Pedidos en Producción</h1>
            <p className="text-sm text-gray-400">Organiza por tipo, asigna al equipo y define el orden de trabajo.</p>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-2 mb-5">
          <button
            onClick={s.openNew}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-brandit-orange text-white hover:opacity-90 active:scale-[0.97] transition-all min-h-[44px]"
          >
            + Nuevo pedido
          </button>
          <button
            onClick={s.openEquipo}
            className="px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 active:scale-[0.97] transition-all min-h-[44px]"
          >
            Equipo
          </button>
        </div>

        {/* Error */}
        {s.error && (
          <div className="mb-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 px-4 py-3 text-sm text-red-600 dark:text-red-400 flex items-center justify-between gap-3">
            <span>{s.error}</span>
            <button onClick={() => s.setError(null)} className="text-red-400 hover:text-red-600 text-xs font-medium">
              Cerrar
            </button>
          </div>
        )}

        {/* Selector de vista */}
        <div className="inline-flex p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl mb-4">
          {VISTAS.map(([k, label]) => (
            <button
              key={k}
              onClick={() => s.setVista(k as typeof s.vista)}
              className={`px-4 py-2 text-sm font-medium rounded-xl transition min-h-[44px] ${
                s.vista === k
                  ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Filtro por tipo (solo en orden general) */}
        {s.vista === "cola" && s.pedidos.length > 0 && (
          <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
            {["Todos", ...TIPOS.map((t) => t.name)].map((t) => (
              <button
                key={t}
                onClick={() => s.setFiltroTipo(t)}
                className={`shrink-0 px-3 py-1.5 text-xs rounded-full border transition ${
                  s.filtroTipo === t
                    ? "bg-brandit-black text-white border-brandit-black"
                    : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {/* Lista / vistas */}
        <PedidoList
          pedidos={s.pedidos}
          equipo={s.equipo}
          loading={s.loading}
          vista={s.vista}
          filtroTipo={s.filtroTipo}
          onNuevo={s.openNew}
          onMover={s.mover}
          onEstado={s.ciclarEstado}
          onEdit={s.openEdit}
          onDelete={s.requestDelete}
        />
      </div>

      {/* Modal crear / editar */}
      <Modal
        open={s.showForm}
        onClose={s.closeForm}
        title={s.editingId ? "Editar pedido" : "Nuevo pedido"}
      >
        <PedidoForm values={s.form} onChange={s.patchForm} equipo={s.equipo} />
        <div className="flex gap-2 pt-5">
          <button
            onClick={s.closeForm}
            className="flex-1 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm hover:bg-gray-50 dark:hover:bg-gray-800 active:scale-[0.97] transition-all min-h-[44px]"
          >
            Cancelar
          </button>
          <button
            onClick={s.saveForm}
            disabled={!s.formValid || s.saving}
            className="flex-1 py-2.5 bg-brandit-black text-white rounded-xl text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50 min-h-[44px]"
          >
            {s.saving ? "Guardando..." : s.editingId ? "Guardar cambios" : "Crear pedido"}
          </button>
        </div>
      </Modal>

      {/* Confirmar borrado */}
      <ConfirmModal
        open={!!s.pendingDelete}
        onClose={s.cancelDelete}
        onConfirm={s.doDelete}
        title="Borrar pedido"
        message={s.pendingDelete ? `¿Borrar el pedido de ${s.pendingDelete.cliente}? Esta acción no se puede deshacer.` : ""}
        confirmLabel="Borrar"
        destructive
      />

      {/* Modal equipo */}
      <EquipoModal
        open={s.showEquipo}
        onClose={s.closeEquipo}
        equipo={s.equipo}
        nuevoTrab={s.nuevoTrab}
        setNuevoTrab={s.setNuevoTrab}
        savingTrab={s.savingTrab}
        onAdd={s.addTrab}
        onDelete={s.delTrab}
      />
    </div>
  );
}
