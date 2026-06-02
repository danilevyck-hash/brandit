"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const DRAFT_PREFIX = "brandit_draft_";
const STALE_DAYS = 7;
const SAVE_INTERVAL_MS = 5000;

interface DraftEnvelope<T> {
  data: T;
  savedAt: number;
}

function getUserId(): string {
  if (typeof window === "undefined") return "anon";
  return sessionStorage.getItem("brandit_user_id") || "anon";
}

function buildKey(key: string): string {
  return `${DRAFT_PREFIX}${key}_${getUserId()}`;
}

function isStale(savedAt: number): boolean {
  return Date.now() - savedAt > STALE_DAYS * 24 * 60 * 60 * 1000;
}

function timeAgo(savedAt: number): string {
  const diffMs = Date.now() - savedAt;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "hace unos segundos";
  if (mins < 60) return `hace ${mins} minuto${mins === 1 ? "" : "s"}`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} hora${hours === 1 ? "" : "s"}`;
  const days = Math.floor(hours / 24);
  return `hace ${days} día${days === 1 ? "" : "s"}`;
}

export interface DraftAutoSaveResult<T> {
  draft: (T & { savedAt: number }) | null;
  hasDraft: boolean;
  clearDraft: () => void;
  draftTimeAgo: string;
}

/**
 * Auto-guarda un borrador en localStorage cada 5s si los datos cambiaron y no
 * están vacíos. En el montaje, recupera el borrador existente (si no está stale).
 * Port del useDraftAutoSave de fashiongr (misma API).
 */
export function useDraftAutoSave<T>(
  key: string,
  data: T,
  isEmpty: (data: T) => boolean,
): DraftAutoSaveResult<T> {
  const [draft, setDraft] = useState<(T & { savedAt: number }) | null>(null);
  const lastSavedJson = useRef<string>("");
  const storageKey = useRef(buildKey(key));

  // En el montaje, chequear borrador existente.
  useEffect(() => {
    storageKey.current = buildKey(key);
    try {
      const raw = localStorage.getItem(storageKey.current);
      if (!raw) return;
      const envelope: DraftEnvelope<T> = JSON.parse(raw);
      if (isStale(envelope.savedAt)) {
        localStorage.removeItem(storageKey.current);
        return;
      }
      setDraft({ ...envelope.data, savedAt: envelope.savedAt });
    } catch {
      localStorage.removeItem(storageKey.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Auto-save cada 5 segundos si los datos cambiaron y no están vacíos.
  useEffect(() => {
    const interval = setInterval(() => {
      if (isEmpty(data)) return;
      const json = JSON.stringify(data);
      if (json === lastSavedJson.current) return;
      lastSavedJson.current = json;
      const envelope: DraftEnvelope<T> = { data, savedAt: Date.now() };
      try {
        localStorage.setItem(storageKey.current, JSON.stringify(envelope));
      } catch {
        // localStorage lleno o no disponible — saltar silenciosamente.
      }
    }, SAVE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [data, isEmpty]);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(storageKey.current);
    setDraft(null);
    lastSavedJson.current = "";
  }, []);

  const draftTimeAgo = draft ? timeAgo(draft.savedAt) : "";

  return { draft, hasDraft: !!draft, clearDraft, draftTimeAgo };
}
