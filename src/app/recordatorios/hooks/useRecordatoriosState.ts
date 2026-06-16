"use client";

import { useState, useEffect, useCallback } from "react";
import { RecordatorioPago } from "../components/types";
import { RecordatorioFormValues } from "../components/RecordatorioForm";
import { hoyPanama } from "../components/RecordatorioList";

const EMPTY_FORM: RecordatorioFormValues = {
  cliente: "",
  monto: "",
  fecha_prometida: "",
  nota: "",
};

export function useRecordatoriosState() {
  const [recordatorios, setRecordatorios] = useState<RecordatorioPago[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form modal (crear / editar)
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RecordatorioFormValues>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Confirmaciones
  const [pendingCumplir, setPendingCumplir] = useState<RecordatorioPago | null>(null);
  const [pendingDelete, setPendingDelete] = useState<RecordatorioPago | null>(null);

  // Modal de cumplidos
  const [showCumplidos, setShowCumplidos] = useState(false);
  const [cumplidos, setCumplidos] = useState<RecordatorioPago[]>([]);
  const [cumplidosLoading, setCumplidosLoading] = useState(false);

  const loadPendientes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/recordatorios");
      if (!res.ok) throw new Error();
      setRecordatorios(await res.json());
    } catch {
      setError("Error al cargar recordatorios");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPendientes();
  }, [loadPendientes]);

  // ── Form ──
  function openNew() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, fecha_prometida: hoyPanama() });
    setShowForm(true);
  }

  function openEdit(r: RecordatorioPago) {
    setEditingId(r.id);
    setForm({
      cliente: r.cliente,
      monto: r.monto === null || r.monto === undefined ? "" : String(r.monto),
      fecha_prometida: r.fecha_prometida,
      nota: r.nota || "",
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
  }

  function patchForm(patch: Partial<RecordatorioFormValues>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  const formValid = form.cliente.trim() !== "" && form.fecha_prometida !== "";

  async function saveForm() {
    if (!formValid || saving) return;
    setSaving(true);
    setError(null);
    const payload = {
      cliente: form.cliente.trim(),
      monto: form.monto.trim() === "" ? null : form.monto.trim(),
      fecha_prometida: form.fecha_prometida,
      nota: form.nota.trim(),
    };
    try {
      const res = editingId
        ? await fetch(`/api/recordatorios/${editingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/recordatorios", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error || "Error al guardar recordatorio");
        return;
      }
      closeForm();
      await loadPendientes();
    } catch {
      setError("Error al guardar recordatorio");
    } finally {
      setSaving(false);
    }
  }

  // ── Cumplir ──
  function requestCumplir(r: RecordatorioPago) {
    setPendingCumplir(r);
  }
  function cancelCumplir() {
    setPendingCumplir(null);
  }
  async function doCumplir() {
    if (!pendingCumplir) return;
    const id = pendingCumplir.id;
    setPendingCumplir(null);
    try {
      const res = await fetch(`/api/recordatorios/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cumplir" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error || "Error al marcar cumplido");
        return;
      }
      await loadPendientes();
    } catch {
      setError("Error al marcar cumplido");
    }
  }

  // ── Borrar (admin) ──
  function requestDelete(r: RecordatorioPago) {
    setPendingDelete(r);
  }
  function cancelDelete() {
    setPendingDelete(null);
  }
  async function doDelete() {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    setPendingDelete(null);
    try {
      const res = await fetch(`/api/recordatorios/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error || "Error al eliminar recordatorio");
        return;
      }
      await loadPendientes();
    } catch {
      setError("Error al eliminar recordatorio");
    }
  }

  // ── Cumplidos modal ──
  async function openCumplidos() {
    setShowCumplidos(true);
    setCumplidosLoading(true);
    try {
      const res = await fetch("/api/recordatorios?cumplidos=1");
      setCumplidos(res.ok ? await res.json() : []);
    } catch {
      setCumplidos([]);
    } finally {
      setCumplidosLoading(false);
    }
  }
  function closeCumplidos() {
    setShowCumplidos(false);
  }
  async function doRestore(r: RecordatorioPago) {
    try {
      const res = await fetch(`/api/recordatorios/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error || "Error al restaurar");
        return;
      }
      setCumplidos((prev) => prev.filter((c) => c.id !== r.id));
      await loadPendientes();
    } catch {
      setError("Error al restaurar");
    }
  }

  return {
    recordatorios, loading, error, setError,
    showForm, editingId, form, saving, formValid,
    openNew, openEdit, closeForm, patchForm, saveForm,
    pendingCumplir, requestCumplir, cancelCumplir, doCumplir,
    pendingDelete, requestDelete, cancelDelete, doDelete,
    showCumplidos, cumplidos, cumplidosLoading, openCumplidos, closeCumplidos, doRestore,
  };
}
