"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

type Usuario = {
  id: string;
  email: string;
  role: string;
  nombre: string;
  password: string;
  empresa: string;
  activo: boolean;
};

type UserForm = {
  email: string;
  role: string;
  nombre: string;
  password: string;
  empresa: string;
  activo: boolean;
};

const emptyForm: UserForm = {
  email: "", role: "vendedora", nombre: "", password: "", empresa: "confecciones_boston", activo: true,
};

export default function UsuariosPage() {
  const router = useRouter();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Usuario | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const r = localStorage.getItem("brandit_role") || "";
    setRole(r);
    if (r !== "admin") router.push("/");
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/usuarios");
    const data = await res.json();
    setUsuarios(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { if (role === "admin") load(); }, [role, load]);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (u: Usuario) => {
    setEditing(u);
    setForm({
      email: u.email,
      role: u.role,
      nombre: u.nombre,
      password: u.password,
      empresa: u.empresa,
      activo: u.activo,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    if (editing) {
      await fetch(`/api/admin/usuarios/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    } else {
      await fetch("/api/admin/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    }
    setSaving(false);
    setShowModal(false);
    load();
  };

  const deleteUser = async (id: string) => {
    if (!confirm("¿Seguro que quieres eliminar este usuario?")) return;
    await fetch(`/api/admin/usuarios/${id}`, { method: "DELETE" });
    load();
  };

  if (role !== "admin") return null;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Administración</p>
          <h1 className="text-3xl font-bold text-brandit-black tracking-tight">Usuarios</h1>
        </div>
        <button onClick={openNew}
          className="bg-brandit-orange text-white rounded-xl px-6 py-2.5 text-sm font-medium hover:bg-brandit-orange/90 transition-colors">
          + Nuevo Usuario
        </button>
      </div>

      {loading ? (
        <div className="text-center py-24 text-gray-300">Cargando...</div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left">
                <th className="px-6 py-3 text-xs font-semibold text-gray-500">Nombre</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500">Email</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500">Rol</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500">Empresa</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500">Estado</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-6 py-3 font-medium text-gray-900">{u.nombre}</td>
                  <td className="px-6 py-3 text-gray-600">{u.email}</td>
                  <td className="px-6 py-3">
                    <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${
                      u.role === "admin" ? "bg-purple-50 text-purple-600" :
                      u.role === "secretaria" ? "bg-blue-50 text-blue-600" :
                      "bg-green-50 text-green-600"
                    }`}>{u.role}</span>
                  </td>
                  <td className="px-6 py-3 text-gray-600 text-xs">{u.empresa}</td>
                  <td className="px-6 py-3">
                    <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${
                      u.activo ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-400"
                    }`}>{u.activo ? "Activo" : "Inactivo"}</span>
                  </td>
                  <td className="px-6 py-3">
                    <button onClick={() => openEdit(u)} className="text-xs text-brandit-orange hover:underline mr-3">Editar</button>
                    <button onClick={() => deleteUser(u.id)} className="text-xs text-red-400 hover:text-red-600">Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-brandit-black mb-4">
              {editing ? "Editar Usuario" : "Nuevo Usuario"}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Nombre</label>
                <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required
                  className="w-full border-b border-gray-200 py-2 text-sm outline-none focus:border-brandit-orange transition-colors bg-transparent" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Email</label>
                <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required
                  className="w-full border-b border-gray-200 py-2 text-sm outline-none focus:border-brandit-orange transition-colors bg-transparent" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Contraseña</label>
                <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required
                  className="w-full border-b border-gray-200 py-2 text-sm outline-none focus:border-brandit-orange transition-colors bg-transparent" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Rol</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full border-b border-gray-200 py-2 text-sm outline-none focus:border-brandit-orange transition-colors bg-transparent">
                  <option value="admin">Admin</option>
                  <option value="secretaria">Secretaria</option>
                  <option value="vendedora">Vendedora</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Empresa</label>
                <select value={form.empresa} onChange={(e) => setForm({ ...form, empresa: e.target.value })}
                  className="w-full border-b border-gray-200 py-2 text-sm outline-none focus:border-brandit-orange transition-colors bg-transparent">
                  <option value="confecciones_boston">Confecciones Boston</option>
                  <option value="brand_it">Brand It</option>
                  <option value="ambas">Ambas</option>
                </select>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs text-gray-400">Activo</label>
                <button type="button" onClick={() => setForm({ ...form, activo: !form.activo })}
                  className={`w-10 h-6 rounded-full transition-colors relative ${form.activo ? "bg-brandit-orange" : "bg-gray-300"}`}>
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.activo ? "left-[18px]" : "left-0.5"}`} />
                </button>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving}
                  className="bg-brandit-orange text-white rounded-xl px-6 py-2.5 text-sm font-medium hover:bg-brandit-orange/90 transition-colors disabled:opacity-50">
                  {saving ? "Guardando..." : editing ? "Actualizar" : "Crear"}
                </button>
                <button type="button" onClick={() => setShowModal(false)}
                  className="border border-gray-200 text-gray-600 rounded-xl px-4 py-2 text-sm hover:border-gray-300 transition-colors">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
