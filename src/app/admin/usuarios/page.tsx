"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

type UserRole = {
  id: string;
  email: string;
  nombre: string;
  role: string;
  created_at: string;
};

const ROLES = [
  { value: "admin", label: "Admin" },
  { value: "secretaria", label: "Secretaria" },
  { value: "vendedora", label: "Vendedora" },
];

export default function UsuariosPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ nombre: "", email: "", password: "", role: "vendedora" });

  useEffect(() => {
    const role = localStorage.getItem("brandit_role");
    if (role !== "admin") {
      router.push("/");
    }
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/usuarios");
    const data = await res.json();
    setUsers(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);

    const res = await fetch("/api/admin/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();

    if (data.error) {
      setError(data.error);
      setSaving(false);
      return;
    }

    setForm({ nombre: "", email: "", password: "", role: "vendedora" });
    setShowForm(false);
    setSaving(false);
    load();
  };

  const deleteUser = async (id: string, email: string) => {
    if (!confirm(`¿Eliminar usuario ${email}?`)) return;
    await fetch(`/api/admin/usuarios/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-end justify-between mb-10">
        <div>
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Usuarios</h1>
          <p className="text-sm text-gray-400 mt-1">Administración de acceso</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-navy text-white font-semibold px-6 py-3 rounded-xl text-sm hover:bg-navy/90 transition-colors shadow-sm"
        >
          + Agregar Usuario
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-50 p-6 mb-6">
          <h3 className="font-semibold text-navy mb-4">Nuevo Usuario</h3>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <input placeholder="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required
              className="bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-navy/10 focus:border-navy/30 outline-none" />
            <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required
              className="bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-navy/10 focus:border-navy/30 outline-none" />
            <input type="password" placeholder="Contraseña" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6}
              className="bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-navy/10 focus:border-navy/30 outline-none" />
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-navy/10 focus:border-navy/30 outline-none">
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          {error && <p className="text-red-500 text-xs mb-3">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={saving}
              className="bg-navy text-white font-semibold px-6 py-2 rounded-xl text-sm hover:bg-navy/90 transition-colors disabled:opacity-50">
              {saving ? "Creando..." : "Crear Usuario"}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="text-sm text-gray-400 hover:text-gray-600 px-4 py-2">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-24 text-gray-300 text-lg">Cargando...</div>
      ) : users.length === 0 ? (
        <div className="text-center py-24">
          <p className="text-gray-400 text-lg">No hay usuarios registrados</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-50 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left">
                <th className="px-5 py-3 text-xs font-semibold text-navy">Nombre</th>
                <th className="px-5 py-3 text-xs font-semibold text-navy">Email</th>
                <th className="px-5 py-3 text-xs font-semibold text-navy">Rol</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-5 py-3 text-gray-900 font-medium">{u.nombre}</td>
                  <td className="px-5 py-3 text-gray-600">{u.email}</td>
                  <td className="px-5 py-3">
                    <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${
                      u.role === "admin" ? "bg-navy/10 text-navy" :
                      u.role === "secretaria" ? "bg-blue-50 text-blue-600" :
                      "bg-gray-100 text-gray-500"
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => deleteUser(u.id, u.email)} className="text-xs text-red-400 hover:text-red-600">
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
