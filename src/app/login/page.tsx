"use client";

import { useState } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Error al ingresar");
      setLoading(false);
      return;
    }

    localStorage.setItem("brandit_role", data.role);
    localStorage.setItem("brandit_email", data.email);
    localStorage.setItem("brandit_nombre", data.nombre);
    localStorage.setItem("brandit_empresa", data.empresa || "");

    if (data.role === "vendedora") {
      window.location.href = "/leads";
    } else {
      window.location.href = "/";
    }
  };

  return (
    <div className="min-h-screen bg-brandit-black flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/brandit-logo.svg" alt="Brand It" className="h-16 w-16 mx-auto mb-4 object-contain rounded-xl" />
        </div>

        <form onSubmit={handleLogin}>
          <div className="mb-6">
            <input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
              className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brandit-orange/20 focus:border-brandit-orange/40 outline-none"
            />
          </div>

          {error && (
            <p className="text-red-500 text-xs text-center mb-4">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brandit-orange text-white font-semibold py-3 rounded-xl text-sm hover:bg-brandit-orange/90 transition-colors disabled:opacity-50"
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}
