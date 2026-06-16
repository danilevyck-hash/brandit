"use client";

import { useState, useEffect } from "react";

/**
 * Copia del patrón useRecordatoriosAuth de Brand It.
 * Lee el role de localStorage SOLO para UX (no gatea nada en este módulo: el
 * borrado y el equipo están abiertos a los tres roles). La seguridad real está
 * en requireRoles() de la API.
 */
export function usePedidosAuth() {
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
