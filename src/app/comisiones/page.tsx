"use client";

// Página de Comisiones. Gate de admin patrón Brand It: el role de localStorage es
// solo para UI (la seguridad real vive en requireRoles de la API). Un no-admin ve
// un mensaje de no autorizado.

import { useEffect, useState } from "react";
import ComisionesClient from "./ComisionesClient";

export default function ComisionesPage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    setIsAdmin(localStorage.getItem("brandit_role") === "admin");
    setAuthChecked(true);
  }, []);

  if (!authChecked) return null;

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No tienes acceso a Comisiones. Contacta al administrador.
          </p>
        </div>
      </div>
    );
  }

  return <ComisionesClient />;
}
