"use client";

import { useState, useEffect } from "react";

/**
 * Como useState pero persiste en sessionStorage.
 * Key format: brandit_ui_{module}_{key}
 *
 * Port del usePersistedState de fashiongr (firma idéntica: module, key, default).
 */
export function usePersistedState<T>(
  module: string,
  key: string,
  defaultValue: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const storageKey = `brandit_ui_${module}_${key}`;

  const [state, setState] = useState<T>(() => {
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored !== null) return JSON.parse(stored) as T;
    } catch {
      /* noop */
    }
    return defaultValue;
  });

  // Guardar en sessionStorage en cada cambio.
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      /* noop */
    }
  }, [storageKey, state]);

  return [state, setState];
}
