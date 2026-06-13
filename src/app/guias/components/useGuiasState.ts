"use client";

// Hook del LISTADO de guías (Brand It). El form vive en /guias/nueva y
// /guias/[id]/editar usando useGuiaFormState (archivo hermano).
//
// Port del useGuiasState de fashiongr. Adaptaciones Brand It:
// - getSession/useAuth de FG eliminados (mono-empresa, sin role gating).
// - Toasts via useToast() de Brand It (en vez del toast interno de FG).
// - Sin campo `empresa`.
// - Fetch a /api/guias, /api/guias/[id], /api/transportistas.

import { useState, useCallback } from "react";
import type { Guia } from "./types";
import { usePersistedState } from "../hooks/usePersistedState";
import { useToast } from "@/components/Toast";

export function useGuiasState() {
  const { toast } = useToast();

  const [guias, setGuias] = useState<Guia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Accordion expanded row (persistido en sessionStorage)
  const [expandedId, setExpandedId] = usePersistedState<string | null>("guias", "expanded", null);
  const [expandedGuia, setExpandedGuia] = useState<Guia | null>(null);
  const [expandedLoading, setExpandedLoading] = useState(false);

  // Confirm delete state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // showToast: misma firma que en FG, pero delega en el Toast de Brand It.
  const showToast = useCallback(
    (msg: string, type: "success" | "error" | "info" = "success") => {
      toast(msg, type);
    },
    [toast],
  );

  const loadGuias = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/guias");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setGuias(data);
    } catch {
      setError("Error al cargar guías");
    } finally {
      setLoading(false);
    }
  }, []);

  async function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      setExpandedGuia(null);
      return;
    }
    setExpandedId(id);
    setExpandedLoading(true);
    try {
      const res = await fetch(`/api/guias/${id}`);
      if (res.ok) {
        const g = await res.json();
        setExpandedGuia(g);
      }
    } catch {
      showToast("Error al cargar detalles", "error");
    }
    setExpandedLoading(false);
  }

  function requestDeleteGuia(id: string) {
    setConfirmDeleteId(id);
  }

  async function confirmDeleteGuia() {
    if (!confirmDeleteId) return;
    try {
      const res = await fetch(`/api/guias/${confirmDeleteId}`, { method: "DELETE" });
      if (res.ok) {
        showToast("Guía eliminada");
      } else {
        showToast("Error al eliminar guía", "error");
      }
    } catch {
      showToast("Error al eliminar guía", "error");
    }
    setConfirmDeleteId(null);
    setExpandedId(null);
    setExpandedGuia(null);
    loadGuias();
  }

  async function rejectGuia(id: string, motivo: string) {
    const res = await fetch(`/api/guias/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "Rechazada", observaciones: motivo }),
    });
    if (res.ok) {
      showToast("Guía rechazada");
      if (expandedId === id) {
        const fullRes = await fetch(`/api/guias/${id}`);
        if (fullRes.ok) setExpandedGuia(await fullRes.json());
      }
      loadGuias();
    } else {
      showToast("Error al rechazar", "error");
    }
  }

  return {
    guias,
    loading,
    error,
    search,
    setSearch,
    expandedId,
    expandedGuia,
    expandedLoading,
    toggleExpand,
    showToast,
    loadGuias,
    confirmDeleteId,
    setConfirmDeleteId,
    requestDeleteGuia,
    confirmDeleteGuia,
    rejectGuia,
  };
}
