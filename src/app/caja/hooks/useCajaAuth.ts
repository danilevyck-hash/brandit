"use client";

import { useState, useEffect } from "react";

/**
 * Brand It replacement for fashiongr's useAuth.
 * Brand It is single-owner (mono-empresa), so there is no role gating:
 * - Does NOT redirect.
 * - Does NOT read sessionStorage cxc_role or call hasModuleAccess.
 * - isOwner is always true.
 *
 * Same return shape as fashiongr's useAuth so consuming pages don't change,
 * but it takes NO arguments.
 */
export function useCajaAuth() {
  const [authChecked, setAuthChecked] = useState(false);
  const [role, setRole] = useState("");

  useEffect(() => {
    setRole(localStorage.getItem("brandit_role") || "");
    setAuthChecked(true);
  }, []);

  return {
    authChecked,
    role,
    isOwner: true,
  };
}
