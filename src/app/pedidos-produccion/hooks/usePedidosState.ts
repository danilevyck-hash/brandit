"use client";

import { useState, useEffect, useCallback } from "react";
import { PedidoProduccion, Trabajador, TIPOS, ORDEN_ESTADO } from "../components/types";
import { PedidoFormValues } from "../components/PedidoForm";

export type Vista = "cola" | "trabajador" | "tipo";

const EMPTY_FORM: PedidoFormValues = {
  cliente: "",
  tipo: TIPOS[0].name,
  trabajador: "",
  estado: "Pendiente",
  fecha_entrega: "",
  notas: "",
};

export function usePedidosState() {
  const [pedidos, setPedidos] = useState<PedidoProduccion[]>([]);
  const [equipo, setEquipo] = useState<Trabajador[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Vista + filtro
  const [vista, setVista] = useState<Vista>("cola");
  const [filtroTipo, setFiltroTipo] = useState<string>("Todos");

  // Form modal (crear / editar)
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PedidoFormValues>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Confirmación de borrado
  const [pendingDelete, setPendingDelete] = useState<PedidoProduccion | null>(null);

  // Modal de equipo
  const [showEquipo, setShowEquipo] = useState(false);
  const [nuevoTrab, setNuevoTrab] = useState("");
  const [savingTrab, setSavingTrab] = useState(false);

  const loadPedidos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/pedidos-produccion");
      if (!res.ok) throw new Error();
      setPedidos(await res.json());
    } catch {
      setError("Error al cargar pedidos");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadEquipo = useCallback(async () => {
    try {
      const res = await fetch("/api/pedidos-equipo");
      setEquipo(res.ok ? await res.json() : []);
    } catch {
      setEquipo([]);
    }
  }, []);

  useEffect(() => {
    loadPedidos();
    loadEquipo();
  }, [loadPedidos, loadEquipo]);

  // ── Form ──
  function openNew() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(p: PedidoProduccion) {
    setEditingId(p.id);
    setForm({
      cliente: p.cliente,
      tipo: p.tipo,
      trabajador: p.trabajador || "",
      estado: p.estado,
      fecha_entrega: p.fecha_entrega || "",
      notas: p.notas || "",
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
  }

  function patchForm(patch: Partial<PedidoFormValues>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  const formValid = form.cliente.trim() !== "";

  async function saveForm() {
    if (!formValid || saving) return;
    setSaving(true);
    setError(null);
    const payload = {
      cliente: form.cliente.trim(),
      tipo: form.tipo,
      trabajador: form.trabajador.trim(),
      estado: form.estado,
      fecha_entrega: form.fecha_entrega || null,
      notas: form.notas.trim(),
    };
    try {
      const res = editingId
        ? await fetch(`/api/pedidos-produccion/${editingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/pedidos-produccion", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error || "Error al guardar el pedido");
        return;
      }
      closeForm();
      await loadPedidos();
    } catch {
      setError("Error al guardar el pedido");
    } finally {
      setSaving(false);
    }
  }

  // ── Ciclar estado (optimista) ──
  async function ciclarEstado(p: PedidoProduccion) {
    const i = ORDEN_ESTADO.indexOf(p.estado);
    const next = ORDEN_ESTADO[(i + 1) % ORDEN_ESTADO.length];
    setPedidos((prev) => prev.map((x) => (x.id === p.id ? { ...x, estado: next } : x)));
    try {
      const res = await fetch(`/api/pedidos-produccion/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ciclar-estado" }),
      });
      if (!res.ok) {
        setError("Error al cambiar el estado");
        await loadPedidos();
      }
    } catch {
      setError("Error al cambiar el estado");
      await loadPedidos();
    }
  }

  // ── Reordenar cola general (optimista + persiste) ──
  async function mover(id: string, dir: -1 | 1) {
    const i = pedidos.findIndex((p) => p.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= pedidos.length) return;
    const next = [...pedidos];
    [next[i], next[j]] = [next[j], next[i]];
    const reindexed = next.map((p, idx) => ({ ...p, orden: idx + 1 }));
    setPedidos(reindexed);
    try {
      const res = await fetch("/api/pedidos-produccion/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: reindexed.map((p) => ({ id: p.id, orden: p.orden })) }),
      });
      if (!res.ok) {
        setError("Error al reordenar");
        await loadPedidos();
      }
    } catch {
      setError("Error al reordenar");
      await loadPedidos();
    }
  }

  // ── Borrar pedido ──
  function requestDelete(p: PedidoProduccion) {
    setPendingDelete(p);
  }
  function cancelDelete() {
    setPendingDelete(null);
  }
  async function doDelete() {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    setPendingDelete(null);
    try {
      const res = await fetch(`/api/pedidos-produccion/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error || "Error al eliminar el pedido");
        return;
      }
      await loadPedidos();
    } catch {
      setError("Error al eliminar el pedido");
    }
  }

  // ── Equipo ──
  function openEquipo() {
    setShowEquipo(true);
  }
  function closeEquipo() {
    setShowEquipo(false);
    setNuevoTrab("");
  }
  async function addTrab() {
    const nombre = nuevoTrab.trim();
    if (!nombre || savingTrab) return;
    if (equipo.some((t) => t.nombre.toLowerCase() === nombre.toLowerCase())) {
      setError("Ese trabajador ya existe.");
      return;
    }
    setSavingTrab(true);
    try {
      const res = await fetch("/api/pedidos-equipo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error || "Error al agregar trabajador");
        return;
      }
      setNuevoTrab("");
      await loadEquipo();
    } catch {
      setError("Error al agregar trabajador");
    } finally {
      setSavingTrab(false);
    }
  }
  async function delTrab(t: Trabajador) {
    try {
      const res = await fetch(`/api/pedidos-equipo/${t.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error || "Error al eliminar trabajador");
        return;
      }
      await loadEquipo();
    } catch {
      setError("Error al eliminar trabajador");
    }
  }

  return {
    pedidos, equipo, loading, error, setError,
    vista, setVista, filtroTipo, setFiltroTipo,
    showForm, editingId, form, saving, formValid,
    openNew, openEdit, closeForm, patchForm, saveForm,
    ciclarEstado, mover,
    pendingDelete, requestDelete, cancelDelete, doDelete,
    showEquipo, openEquipo, closeEquipo,
    nuevoTrab, setNuevoTrab, savingTrab, addTrab, delTrab,
  };
}
