"use client";

import { useRouter } from "next/navigation";
import { useGuiaAuth } from "../hooks/useGuiaAuth";
import GuiaForm from "../components/GuiaForm";
import { useGuiaFormState } from "../components/useGuiaFormState";

export default function GuiaNuevaPage() {
  const router = useRouter();
  const { authChecked } = useGuiaAuth();

  const s = useGuiaFormState({ editingId: null });

  if (!authChecked) return null;

  return (
    <div className="min-h-screen">
      <GuiaForm
        editingId={null}
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
        tipoDespacho={s.tipoDespacho}
        setTipoDespacho={s.setTipoDespacho}
        placa={s.placa}
        setPlaca={s.setPlaca}
        receptorNombre={s.receptorNombre}
        setReceptorNombre={s.setReceptorNombre}
        cedula={s.cedula}
        setCedula={s.setCedula}
        nombreChofer={s.nombreChofer}
        setNombreChofer={s.setNombreChofer}
        firma1={s.firma1}
        setFirma1={s.setFirma1}
        firma2={s.firma2}
        setFirma2={s.setFirma2}
        onCancel={() => router.push("/guias")}
        hasDraft={s.hasGuiaDraft}
        draftTimeAgo={s.guiaDraftTimeAgo}
        onRestoreDraft={s.restoreGuiaDraft}
        onDiscardDraft={s.clearGuiaDraft}
      />
    </div>
  );
}
