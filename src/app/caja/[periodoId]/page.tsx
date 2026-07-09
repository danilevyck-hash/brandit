"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ConfirmModal } from "../components/ui";
import { fmt, fmtDate } from "@/lib/format";

import { useCajaState } from "../hooks/useCajaState";
import { useCajaAuth } from "../hooks/useCajaAuth";
import PeriodoDetailHeader from "../components/PeriodoDetailHeader";
import GastoTable from "../components/GastoTable";
import DeletedGastosModal from "../components/DeletedGastosModal";
import { useState } from "react";
import "../skin.css";

export default function PeriodoDetailPage() {
  const router = useRouter();
  const params = useParams<{ periodoId: string }>();
  const periodoId = params?.periodoId ?? "";
  const { authChecked } = useCajaAuth();

  const [showDeletedModal, setShowDeletedModal] = useState(false);

  const {
    current, error, detailError,
    allCategorias,
    allResponsables,
    editingGastoId, setEditingGastoId, editGasto, setEditGasto,
    confirmClosePeriodo, setConfirmClosePeriodo,
    confirmDeletePeriodoId, setConfirmDeletePeriodoId,
    loadDetail,
    requestClosePeriodo, doClosePeriodo,
    requestDeletePeriodo, doDeletePeriodo,
    aprobarReposicion,
    requestDeleteGasto, saveEditGasto, exportExcel,
    pendingDeleteGasto, doDeleteGasto, cancelDeleteGasto,
    pendingRestoreGasto, requestRestoreGasto, doRestoreGasto, cancelRestoreGasto,
  } = useCajaState({ onPeriodoDeleted: () => router.push("/caja") });

  useEffect(() => {
    if (authChecked && periodoId) loadDetail(periodoId);
  }, [authChecked, periodoId, loadDetail]);

  if (!authChecked) return null;

  if (detailError) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 text-center">
        <p className="text-gray-500 mb-4">No se encontró este período (puede haber sido eliminado).</p>
        <button onClick={() => router.push("/caja")} className="px-5 py-2.5 rounded-xl bg-brandit-black text-white text-sm font-medium active:scale-[0.97] min-h-[44px]">
          Volver a Caja
        </button>
      </div>
    );
  }

  if (!current) {
    return (
      <div>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <div className="h-48 bg-gray-100 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  const detailGastos = current.caja_gastos || [];
  const detailTotalGastado = detailGastos.reduce((s, g) => s + (Number(g.total) || 0), 0);
  const detailFondoInicial = Number(current.fondo_inicial) || 0;
  const detailSaldo = detailFondoInicial - detailTotalGastado;
  const detailIsOpen = current.estado === "abierto";
  const detailPctUsed = detailFondoInicial > 0 ? (detailSaldo / detailFondoInicial) * 100 : 100;

  return (
    <div>
      <div className="skin-caja min-h-screen">
        <PeriodoDetailHeader
          current={current}
          totalGastado={detailTotalGastado}
          saldo={detailSaldo}
          pctUsed={detailPctUsed}
          onBack={() => router.push("/caja")}
          onClosePeriodo={detailIsOpen ? () => requestClosePeriodo(current.id) : undefined}
          onPrint={() => router.push(`/caja/${current.id}/imprimir`)}
          onExportExcel={exportExcel}
          onAprobarReposicion={aprobarReposicion}
          deletedCount={(current.deleted_gastos || []).length}
          onViewDeleted={() => setShowDeletedModal(true)}
        />

        <div className="max-w-6xl mx-auto px-5 sm:px-9 pt-6 pb-14">
          {error && (
            <p
              className="text-sm mb-4 px-3 py-2 rounded-md"
              style={{
                color: "var(--caja-danger-onSoft)",
                background: "var(--caja-danger-soft)",
                border: "1px solid var(--caja-danger-border)",
              }}
            >
              {error}
            </p>
          )}

          <GastoTable
            gastos={detailGastos}
            isOpen={!!detailIsOpen}
            categorias={allCategorias}
            responsables={allResponsables}
            editingGastoId={editingGastoId}
            editGasto={editGasto}
            setEditingGastoId={setEditingGastoId}
            setEditGasto={setEditGasto}
            onSaveEdit={saveEditGasto}
            onDeleteGasto={requestDeleteGasto}
            nuevoHref={detailIsOpen ? `/caja/${current.id}/nuevo` : undefined}
          />
        </div>
      </div>

      <DeletedGastosModal
        open={showDeletedModal}
        onClose={() => setShowDeletedModal(false)}
        deletedGastos={current.deleted_gastos || []}
        periodOpen={!!detailIsOpen}
        onRestore={requestRestoreGasto}
      />

      <ConfirmModal
        open={!!confirmClosePeriodo}
        onClose={() => setConfirmClosePeriodo(null)}
        onConfirm={doClosePeriodo}
        title="Cerrar período"
        message="¿Cerrar este período? No podrá agregar más gastos."
        confirmLabel="Cerrar período"
        destructive
      />
      <ConfirmModal
        open={!!confirmDeletePeriodoId}
        onClose={() => setConfirmDeletePeriodoId(null)}
        onConfirm={doDeletePeriodo}
        title="Eliminar período"
        message="¿Eliminar este período y todos sus gastos? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        destructive
      />
      {pendingDeleteGasto && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50" onClick={cancelDeleteGasto}>
          <div className="bg-white sm:rounded-lg rounded-t-2xl p-6 max-w-sm w-full mx-0 sm:mx-4 border border-gray-200" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-medium mb-3">¿Eliminar este gasto?</h3>
            <p className="text-sm text-gray-800 mb-2">
              Gasto &ldquo;{pendingDeleteGasto.descripcion?.trim() || "Sin descripción"}&rdquo; · ${fmt(pendingDeleteGasto.total)} · {pendingDeleteGasto.categoria || "Sin categoría"} · {pendingDeleteGasto.responsable || "Sin responsable"} · {fmtDate(pendingDeleteGasto.fecha)}
            </p>
            <p className="text-xs text-gray-500 mb-6">
              Podrás restaurarlo desde Gastos eliminados si es un error.
            </p>
            <div className="flex gap-3">
              <button
                onClick={doDeleteGasto}
                className="flex-1 px-4 py-2.5 rounded-md text-sm font-medium bg-red-600 text-white hover:bg-red-700 active:scale-[0.97] transition-all min-h-[44px]"
              >
                Sí, eliminar
              </button>
              <button
                onClick={cancelDeleteGasto}
                className="flex-1 border border-gray-200 text-gray-600 px-4 py-2.5 rounded-md text-sm hover:bg-gray-50 active:bg-gray-100 transition-all min-h-[44px]"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
      {pendingRestoreGasto && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50" onClick={cancelRestoreGasto}>
          <div className="bg-white sm:rounded-lg rounded-t-2xl p-6 max-w-sm w-full mx-0 sm:mx-4 border border-gray-200" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-medium mb-3">¿Restaurar este gasto?</h3>
            <p className="text-sm text-gray-800 mb-6">
              Gasto &ldquo;{pendingRestoreGasto.descripcion?.trim() || "Sin descripción"}&rdquo; · ${fmt(pendingRestoreGasto.total)} · {pendingRestoreGasto.categoria || "Sin categoría"} · {pendingRestoreGasto.responsable || "Sin responsable"} · {fmtDate(pendingRestoreGasto.fecha)}
            </p>
            <div className="flex gap-3">
              <button
                onClick={doRestoreGasto}
                className="flex-1 px-4 py-2.5 rounded-md text-sm font-medium bg-black text-white hover:bg-gray-800 active:scale-[0.97] transition-all min-h-[44px]"
              >
                Sí, restaurar
              </button>
              <button
                onClick={cancelRestoreGasto}
                className="flex-1 border border-gray-200 text-gray-600 px-4 py-2.5 rounded-md text-sm hover:bg-gray-50 active:bg-gray-100 transition-all min-h-[44px]"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
