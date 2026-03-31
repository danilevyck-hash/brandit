"use client";

import { useState } from "react";
import { supabaseAuth } from "@/lib/supabase-auth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: authError } = await supabaseAuth.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError("Credenciales incorrectas");
      setLoading(false);
      return;
    }

    // Check user role
    const { data: roleData, error: roleError } = await supabaseAuth
      .from("user_roles")
      .select("role, nombre")
      .eq("email", email.toLowerCase())
      .single();

    if (roleError || !roleData) {
      setError("Usuario no autorizado. Contacte al administrador.");
      await supabaseAuth.auth.signOut();
      setLoading(false);
      return;
    }

    localStorage.setItem("brandit_role", roleData.role);
    localStorage.setItem("brandit_email", email.toLowerCase());
    localStorage.setItem("brandit_nombre", roleData.nombre || "");

    // Use window.location.href to force full reload so Navbar reads fresh localStorage
    if (roleData.role === "vendedora") {
      window.location.href = "/leads";
    } else {
      window.location.href = "/";
    }
  };

  return (
    <div className="min-h-screen bg-brandit-black flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight uppercase">
            <span className="text-brandit-black">BRAND</span>
            <span className="text-brandit-blue">/</span>
            <span className="text-brandit-black">IT</span>
            <span className="text-brandit-orange">.</span>
          </h1>
          <p className="text-[11px] text-brandit-gray font-medium mt-1">by Confecciones Boston</p>
        </div>

        <form onSubmit={handleLogin}>
          <div className="space-y-3 mb-6">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brandit-orange/20 focus:border-brandit-orange/40 outline-none"
            />
            <input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
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
