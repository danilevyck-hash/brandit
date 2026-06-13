"use client";

// Hook del FORM de guía (crear o editar) — Brand It.
// Port del useGuiaFormState de fashiongr. Adaptaciones:
// - Sin campo `empresa` (mono-empresa): se eliminó DEFAULT_EMPRESAS, empresas,
//   addEmpresa y la validación `item-${idx}-empresa`.
// - Toasts via useToast() de Brand It.
// - useDraftAutoSave + listas dinámicas desde hooks/constants locales.
// - Smart defaults guardados con prefijo brandit_last_*.
// - Validaciones de facturas (coma+espacio, ≥4 dígitos) VERBATIM.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useDraftAutoSave } from "../hooks/useDraftAutoSave";
import type { GuiaItem, ModoEntrega, Transportista } from "./types";
import {
  DEFAULT_CLIENTES,
  DEFAULT_DIRECCIONES,
  loadList,
  saveList,
  emptyItem,
} from "./constants";
import { useToast } from "@/components/Toast";
import { fmtGuia } from "@/lib/format";

interface Options {
  editingId?: string | null; // null = creación
}

export function useGuiaFormState({ editingId = null }: Options = {}) {
  const router = useRouter();
  const { toast } = useToast();

  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Set<string>>(new Set());

  // Catálogo canónico de transportistas (vive en DB, no localStorage).
  const [transportistas, setTransportistas] = useState<Transportista[]>([]);
  const [clientes, setClientes] = useState<string[]>(DEFAULT_CLIENTES);
  const [direcciones, setDirecciones] = useState<string[]>(DEFAULT_DIRECCIONES);

  // Form state
  const [editingEstado, setEditingEstado] = useState<string | null>(null);
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [modoEntrega, setModoEntrega] = useState<ModoEntrega>(() => {
    try {
      return (localStorage.getItem("brandit_last_modo_entrega") as ModoEntrega) || "transportista";
    } catch {
      return "transportista";
    }
  });
  const [transportistaId, setTransportistaId] = useState<string | null>(() => {
    try {
      return localStorage.getItem("brandit_last_transportista_id") || null;
    } catch {
      return null;
    }
  });
  const [entregadoPor, setEntregadoPor] = useState(() => {
    try {
      return localStorage.getItem("brandit_last_entregado_por") || "";
    } catch {
      return "";
    }
  });
  const [observaciones, setObservaciones] = useState("");
  const [items, setItems] = useState<GuiaItem[]>([emptyItem(1)]);
  const [formNumero, setFormNumero] = useState(1);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(editingId === null);

  // Despacho en un paso (solo creación): la guía nace "Completada".
  const [tipoDespacho, setTipoDespacho] = useState<"externo" | "directo">("externo");
  const [placa, setPlaca] = useState("");
  const [receptorNombre, setReceptorNombre] = useState("");
  const [cedula, setCedula] = useState("");
  const [nombreChofer, setNombreChofer] = useState("");
  const [firma1, setFirma1] = useState<string | null>(null);
  const [firma2, setFirma2] = useState<string | null>(null);

  const showToast = useCallback(
    (msg: string, type: "success" | "error" | "info" = "success") => {
      toast(msg, type);
    },
    [toast],
  );

  // Cargar listas dinámicas + catálogo de transportistas
  useEffect(() => {
    setClientes(loadList("brandit_clientes", DEFAULT_CLIENTES));
    setDirecciones(loadList("brandit_direcciones", DEFAULT_DIRECCIONES));
    fetch("/api/transportistas", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Transportista[]) => setTransportistas(data || []))
      .catch(() => {
        /* el form muestra el modo "Entrega directa" como fallback */
      });
  }, []);

  // Si es edición: cargar la guía una sola vez
  useEffect(() => {
    if (!editingId) return;
    let cancelado = false;
    (async () => {
      try {
        const res = await fetch(`/api/guias/${editingId}`, { cache: "no-store" });
        if (!res.ok) throw new Error("No se pudo cargar la guía");
        const g = await res.json();
        if (cancelado) return;
        setEditingEstado(g.estado || null);
        setFormNumero(g.numero);
        setFecha(g.fecha);
        if (g.modo_entrega === "transportista" || g.modo_entrega === "entrega_directa") {
          setModoEntrega(g.modo_entrega);
        } else {
          setModoEntrega(g.transportista_id ? "transportista" : "entrega_directa");
        }
        setTransportistaId(g.transportista_id || null);
        setEntregadoPor(g.entregado_por || "");
        setObservaciones(g.observaciones || "");
        const guiaItems = (g.guia_items || []) as GuiaItem[];
        setItems(
          guiaItems.length > 0
            ? guiaItems.map((item, i) => ({ ...item, orden: i + 1 }))
            : [emptyItem(1)],
        );
        setLoaded(true);
      } catch {
        if (!cancelado) {
          showToast("Error al cargar guía", "error");
          router.push("/guias");
        }
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [editingId, router, showToast]);

  // Siguiente número para creación
  useEffect(() => {
    if (editingId) return;
    fetch("/api/guias")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Array<{ numero: number }>) => {
        setFormNumero(data.length > 0 ? data[0].numero + 1 : 1);
      })
      .catch(() => {});
  }, [editingId]);

  // Draft auto-save (incluye modo + FK)
  const guiaDraftData = useMemo(
    () => ({ modoEntrega, transportistaId, entregadoPor, items, observaciones }),
    [modoEntrega, transportistaId, entregadoPor, items, observaciones],
  );
  const isGuiaDraftEmpty = useCallback((d: typeof guiaDraftData) => {
    return (
      !d.transportistaId &&
      !d.entregadoPor &&
      !d.observaciones &&
      d.items.every((i) => !i.cliente && !i.direccion && !i.facturas && (!i.bultos || i.bultos === 0))
    );
  }, []);
  const {
    draft: guiaDraft,
    hasDraft: hasGuiaDraft,
    clearDraft: clearGuiaDraft,
    draftTimeAgo: guiaDraftTimeAgo,
  } = useDraftAutoSave("guia", guiaDraftData, isGuiaDraftEmpty);

  function restoreGuiaDraft() {
    if (!guiaDraft) return;
    if (guiaDraft.modoEntrega === "transportista" || guiaDraft.modoEntrega === "entrega_directa") {
      setModoEntrega(guiaDraft.modoEntrega);
    }
    setTransportistaId(guiaDraft.transportistaId || null);
    setEntregadoPor(guiaDraft.entregadoPor || "");
    setObservaciones(guiaDraft.observaciones || "");
    if (guiaDraft.items?.length) setItems(guiaDraft.items);
    clearGuiaDraft();
  }

  // Adders de listas dinámicas (transportistas son catálogo controlado por admin)
  function addCliente(name: string) {
    const updated = [...clientes, name];
    setClientes(updated);
    saveList("brandit_clientes", DEFAULT_CLIENTES, updated);
  }
  function addDireccion(name: string) {
    const updated = [...direcciones, name];
    setDirecciones(updated);
    saveList("brandit_direcciones", DEFAULT_DIRECCIONES, updated);
  }

  // Items
  function addRow() {
    setItems([...items, emptyItem(items.length + 1)]);
  }
  function removeRow(idx: number) {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== idx).map((item, i) => ({ ...item, orden: i + 1 })));
  }
  function updateItem(idx: number, field: keyof GuiaItem, value: string | number) {
    setItems(items.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  }

  function validate(firma1Val = "", firma2Val = ""): boolean {
    const errors = new Set<string>();
    if (!fecha) errors.add("fecha");
    if (modoEntrega === "transportista" && !transportistaId) errors.add("transportista");
    if (!entregadoPor) errors.add("entregadoPor");
    // Datos de despacho: requeridos solo al crear (la guía nace despachada).
    if (!editingId) {
      if (!receptorNombre.trim()) errors.add("receptor");
      if (!cedula.trim()) errors.add("cedula");
      if (tipoDespacho === "externo" && !placa.trim()) errors.add("placa");
      if (tipoDespacho === "directo" && !nombreChofer.trim()) errors.add("chofer");
      if (!firma1Val) errors.add("firma1");
      if (!firma2Val) errors.add("firma2");
    }
    const validItems = items.filter(
      (i) => i.cliente || i.direccion || i.facturas || i.bultos > 0,
    );
    if (validItems.length === 0) errors.add("items-empty");
    items.forEach((item, idx) => {
      const hasData = item.cliente || item.direccion || item.facturas || item.bultos > 0;
      if (!hasData) return;
      if (!item.cliente) errors.add(`item-${idx}-cliente`);
      if (!item.direccion) errors.add(`item-${idx}-direccion`);
      if (!item.facturas) {
        errors.add(`item-${idx}-facturas`);
      } else {
        if (item.facturas.includes(",") && !item.facturas.match(/^[^,]+(, [^,]+)*$/)) {
          errors.add(`item-${idx}-facturas-separator`);
        } else if (item.facturas.includes(";")) {
          errors.add(`item-${idx}-facturas-separator`);
        }
        const parts = item.facturas.split(",").map((s) => s.trim()).filter(Boolean);
        if (parts.some((p) => p.replace(/\D/g, "").length < 4))
          errors.add(`item-${idx}-facturas-format`);
      }
      if (!item.bultos || item.bultos <= 0) errors.add(`item-${idx}-bultos`);
    });
    setValidationErrors(errors);
    if (errors.size > 0) {
      setError("Completa todos los campos obligatorios antes de guardar.");
      return false;
    }
    return true;
  }

  async function saveGuia(opts?: { silent?: boolean; firma1?: string; firma2?: string }) {
    const silent = opts?.silent === true;
    const f1 = opts?.firma1 ?? firma1 ?? "";
    const f2 = opts?.firma2 ?? firma2 ?? "";
    if (!validate(f1, f2)) return;
    try {
      localStorage.setItem("brandit_last_modo_entrega", modoEntrega);
      if (transportistaId) localStorage.setItem("brandit_last_transportista_id", transportistaId);
      localStorage.setItem("brandit_last_entregado_por", entregadoPor);
    } catch {
      /* */
    }
    const validItems = items.filter(
      (i) => i.cliente || i.direccion || i.facturas || i.bultos > 0,
    );
    setSaving(true);
    const url = editingId ? `/api/guias/${editingId}` : "/api/guias";
    const method = editingId ? "PUT" : "POST";

    const base: Record<string, unknown> = {
      fecha,
      modo_entrega: modoEntrega,
      transportista_id: modoEntrega === "transportista" ? transportistaId : null,
      entregado_por: entregadoPor,
      observaciones,
      items: validItems,
    };
    // Edición: PUT conserva el estado actual. Creación: POST omite estado
    // (el backend la crea "Completada") y replica el payload de despacho.
    const payload: Record<string, unknown> = editingId
      ? { ...base, estado: editingEstado || "Pendiente Bodega" }
      : {
          ...base,
          tipo_despacho: tipoDespacho,
          receptor_nombre: receptorNombre,
          cedula,
          firma_base64: f1,
          firma_entregador_base64: f2,
          ...(tipoDespacho === "externo" ? { placa } : { nombre_chofer: nombreChofer }),
        };

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setError(null);
      clearGuiaDraft();
      const guia = await res.json();
      if (!editingId && !silent) {
        const totalB = validItems.reduce((s, i) => s + (i.bultos || 0), 0);
        const transpLabel =
          modoEntrega === "entrega_directa"
            ? "Entrega directa"
            : transportistas.find((t) => t.id === transportistaId)?.nombre || "—";
        fetch("/api/guias/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject: `Nueva Guía ${fmtGuia(guia.numero)} — Despachada`,
            body: `<h2>Guía ${fmtGuia(guia.numero)}</h2><p><strong>Transportista:</strong> ${transpLabel}</p><p><strong>Total bultos:</strong> ${totalB}</p><p>Guía creada y despachada.</p>`,
          }),
        }).catch(() => {});
      }
      // En silent (auto-save) NO navega ni resetea — preserva contexto.
      if (!silent) {
        router.push("/guias");
      }
    } else {
      const errData = await res.json().catch(() => ({}));
      setError(errData.error || "Error al guardar. Verifica los datos.");
    }
    setSaving(false);
  }

  return {
    // meta
    editingId,
    loaded,
    error,
    validationErrors,
    showToast,
    // listas
    transportistas,
    clientes,
    direcciones,
    addCliente,
    addDireccion,
    // form
    formNumero,
    fecha,
    setFecha,
    modoEntrega,
    setModoEntrega,
    transportistaId,
    setTransportistaId,
    entregadoPor,
    setEntregadoPor,
    observaciones,
    setObservaciones,
    items,
    saving,
    updateItem,
    addRow,
    removeRow,
    saveGuia,
    // despacho (solo creación)
    tipoDespacho,
    setTipoDespacho,
    placa,
    setPlaca,
    receptorNombre,
    setReceptorNombre,
    cedula,
    setCedula,
    nombreChofer,
    setNombreChofer,
    firma1,
    setFirma1,
    firma2,
    setFirma2,
    // draft
    hasGuiaDraft,
    guiaDraftTimeAgo,
    restoreGuiaDraft,
    clearGuiaDraft,
  };
}
