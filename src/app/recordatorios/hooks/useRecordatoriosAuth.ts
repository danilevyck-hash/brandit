"use client";

import { useState, useEffect } from "react";

/**
 * Copia del patrón useCajaAuth de Brand It.
 * Lee el role de localStorage SOLO para decisiones de UI (mostrar/ocultar el
 * botón de borrar admin). La seguridad real está en requireRoles() de la API.
 */
export function useRecordatoriosAuth() {
  const [authChecked, setAuthChecked] = useState(false);
  const [role, setRole] = useState("");

  useEffect(() => {
    setRole(localStorage.getItem("brandit_role") || "");
    setAuthChecked(true);
  }, []);

  return {
    authChecked,
    role,
    isAdmin: role === "admin",
  };
}
