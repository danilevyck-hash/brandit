"use client";

import { useState, useEffect } from "react";

/**
 * Brand It auth hook para el módulo Guías. Espejo de useCajaAuth.
 * Brand It es mono-empresa: no hay role gating.
 * - NO redirige.
 * - Lee `brandit_role` de localStorage en useEffect.
 * - authChecked pasa a true tras montar.
 * - Sin argumentos.
 */
export function useGuiaAuth() {
  const [authChecked, setAuthChecked] = useState(false);
  const [role, setRole] = useState("");

  useEffect(() => {
    setRole(localStorage.getItem("brandit_role") || "");
    setAuthChecked(true);
  }, []);

  return {
    authChecked,
    role,
  };
}
