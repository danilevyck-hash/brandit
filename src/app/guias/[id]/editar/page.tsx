"use client";

import { useRouter, useParams } from "next/navigation";
import { useGuiaAuth } from "../../hooks/useGuiaAuth";
import GuiaForm from "../../components/GuiaForm";
import { useGuiaFormState } from "../../components/useGuiaFormState";

export default function GuiaEditarPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? null;
  const { authChecked } = useGuiaAuth();

  const s = useGuiaFormState({ editingId: id });

  if (!authChecked) return null;
  if (!id) return null;

  if (!s.loaded) {
    return (
      <div className="min-h-screen">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <div className="h-24 bg-gray-100 rounded-lg animate-pulse mb-4" />
          <div className="h-48 bg-gray-100 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <GuiaForm
        editingId={id}
        formNumero={s.formNumero}
        fecha={s.fecha}
        setFecha={s.setFecha}
        modoEntrega={s.modoEntrega}
        setModoEntrega={s.setModoEntrega}
        transportistaId={s.transportistaId}
        setTransportistaId={s.setTransportistaId}
        entregadoPor={s.entregadoPor}
        setEntregadoPor={s.setEntregadoPor}
        observaciones={s.observaciones}
        setObservaciones={s.setObservaciones}
        items={s.items}
        transportistas={s.transportistas}
        clientes={s.clientes}
        direcciones={s.direcciones}
        validationErrors={s.validationErrors}
        error={s.error}
        saving={s.saving}
        onAddCliente={s.addCliente}
        onAddDireccion={s.addDireccion}
        onUpdateItem={s.updateItem}
        onAddRow={s.addRow}
        onRemoveRow={s.removeRow}
        onSave={s.saveGuia}
        onCancel={() => router.push("/guias")}
        hasDraft={s.hasGuiaDraft}
        draftTimeAgo={s.guiaDraftTimeAgo}
        onRestoreDraft={s.restoreGuiaDraft}
        onDiscardDraft={s.clearGuiaDraft}
      />
    </div>
  );
}
