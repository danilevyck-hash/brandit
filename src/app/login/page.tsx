"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseAuth } from "@/lib/supabase-auth";

export default function LoginPage() {
  const router = useRouter();
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

    if (roleData.role === "vendedora") {
      router.push("/leads");
    } else {
      router.push("/");
    }
  };

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-gray-50 shadow-sm p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-navy font-extrabold text-3xl tracking-tight">Brand It</h1>
          <p className="text-[11px] text-gray-400 font-medium mt-1">by Confecciones Boston</p>
        </div>

        <form onSubmit={handleLogin}>
          <div className="space-y-3 mb-6">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-navy/10 focus:border-navy/30 outline-none"
            />
            <input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-navy/10 focus:border-navy/30 outline-none"
            />
          </div>

          {error && (
            <p className="text-red-500 text-xs text-center mb-4">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-navy text-white font-semibold py-3 rounded-xl text-sm hover:bg-navy/90 transition-colors disabled:opacity-50"
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}
