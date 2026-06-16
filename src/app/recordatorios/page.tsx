"use client";

import { useRecordatoriosAuth } from "./hooks/useRecordatoriosAuth";
import { useRecordatoriosState } from "./hooks/useRecordatoriosState";
import RecordatorioList from "./components/RecordatorioList";
import RecordatorioForm from "./components/RecordatorioForm";
import CumplidosModal from "./components/CumplidosModal";
import { Modal, ConfirmModal } from "./components/ui";

export default function RecordatoriosPage() {
  const { authChecked, isAdmin } = useRecordatoriosAuth();
  const s = useRecordatoriosState();

  if (!authChecked) return null;

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Recordatorios de Pago</h1>
            <p className="text-sm text-gray-400">Promesas de pago de clientes</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={s.openCumplidos}
              className="px-3 py-2 rounded-xl text-sm font-medium border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 active:scale-[0.97] transition-all min-h-[44px]"
            >
              Cumplidos
            </button>
            <button
              onClick={s.openNew}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-brandit-orange text-white hover:opacity-90 active:scale-[0.97] transition-all min-h-[44px]"
            >
              + Nuevo
            </button>
          </div>
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

        {/* Lista */}
        <RecordatorioList
          recordatorios={s.recordatorios}
          loading={s.loading}
          isAdmin={isAdmin}
          onNuevo={s.openNew}
          onEdit={s.openEdit}
          onCumplir={s.requestCumplir}
          onDelete={s.requestDelete}
        />
      </div>

      {/* Modal crear / editar */}
      <Modal
        open={s.showForm}
        onClose={s.closeForm}
        title={s.editingId ? "Editar recordatorio" : "Nuevo recordatorio"}
      >
        <RecordatorioForm values={s.form} onChange={s.patchForm} />
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
            {s.saving ? "Guardando..." : s.editingId ? "Guardar cambios" : "Crear recordatorio"}
          </button>
        </div>
      </Modal>

      {/* Confirmar cumplido */}
      <ConfirmModal
        open={!!s.pendingCumplir}
        onClose={s.cancelCumplir}
        onConfirm={s.doCumplir}
        title="Marcar como cumplido"
        message={s.pendingCumplir ? `¿Marcar el recordatorio de ${s.pendingCumplir.cliente} como cumplido? Saldrá de la lista de pendientes.` : ""}
        confirmLabel="Marcar cumplido"
      />

      {/* Confirmar borrado (admin) */}
      <ConfirmModal
        open={!!s.pendingDelete}
        onClose={s.cancelDelete}
        onConfirm={s.doDelete}
        title="Borrar recordatorio"
        message={s.pendingDelete ? `¿Borrar definitivamente el recordatorio de ${s.pendingDelete.cliente}? Esta acción no se puede deshacer.` : ""}
        confirmLabel="Borrar"
        destructive
      />

      {/* Modal cumplidos */}
      <CumplidosModal
        open={s.showCumplidos}
        onClose={s.closeCumplidos}
        cumplidos={s.cumplidos}
        loading={s.cumplidosLoading}
        onRestore={s.doRestore}
      />
    </div>
  );
}
