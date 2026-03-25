"use client";

import { useState, useEffect, useCallback } from "react";

type Lead = {
  id: string;
  nombre: string;
  empresa: string;
  telefono: string;
  email: string;
  estado: "interesado" | "no_interesado" | "seguimiento";
  notas: string;
  vendedora: string;
  created_at: string;
};

const ESTADOS = [
  { value: "interesado", label: "Interesado", bg: "bg-green-50", text: "text-green-600" },
  { value: "seguimiento", label: "Seguimiento", bg: "bg-yellow-50", text: "text-yellow-600" },
  { value: "no_interesado", label: "No Interesado", bg: "bg-gray-100", text: "text-gray-500" },
] as const;

type LeadForm = {
  nombre: string;
  empresa: string;
  telefono: string;
  email: string;
  estado: Lead["estado"];
  notas: string;
  vendedora: string;
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("");
  const [form, setForm] = useState<LeadForm>({
    nombre: "", empresa: "", telefono: "", email: "", estado: "interesado", notas: "", vendedora: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState("");
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    const r = localStorage.getItem("brandit_role") || "";
    const e = localStorage.getItem("brandit_email") || "";
    setRole(r);
    setUserEmail(e);
  }, []);

  const isVendedora = role === "vendedora";

  const load = useCallback(async () => {
    if (!role) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (filtro) params.set("estado", filtro);
    if (isVendedora && userEmail) params.set("vendedora", userEmail);
    const res = await fetch(`/api/leads?${params}`);
    const data = await res.json();
    setLeads(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [filtro, role, isVendedora, userEmail]);

  useEffect(() => { load(); }, [load]);

  const estadoInfo = (estado: string) => ESTADOS.find((e) => e.value === estado);

  const openNew = () => {
    setForm({
      nombre: "", empresa: "", telefono: "", email: "", estado: "interesado", notas: "",
      vendedora: userEmail,
    });
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (lead: Lead) => {
    if (isVendedora && lead.vendedora !== userEmail) return;
    setForm({
      nombre: lead.nombre || "",
      empresa: lead.empresa || "",
      telefono: lead.telefono || "",
      email: lead.email || "",
      estado: lead.estado,
      notas: lead.notas || "",
      vendedora: lead.vendedora || "",
    });
    setEditingId(lead.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    if (editingId) {
      await fetch(`/api/leads/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    } else {
      await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    }

    setShowForm(false);
    setEditingId(null);
    setSaving(false);
    load();
  };

  const deleteLead = async (id: string) => {
    if (!confirm("¿Eliminar este lead?")) return;
    await fetch(`/api/leads/${id}`, { method: "DELETE" });
    if (editingId === id) {
      setShowForm(false);
      setEditingId(null);
    }
    load();
  };

  const canDelete = (lead: Lead) => {
    if (role === "admin" || role === "secretaria") return true;
    if (isVendedora && lead.vendedora === userEmail) return true;
    return false;
  };

  const canEdit = (lead: Lead) => {
    if (role === "admin" || role === "secretaria") return true;
    if (isVendedora && lead.vendedora === userEmail) return true;
    return false;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-end justify-between mb-10">
        <div>
          <h1 className="text-4xl font-extrabold text-brandit-black tracking-tight">Leads</h1>
          <p className="text-sm text-gray-400 mt-1">Seguimiento de clientes potenciales</p>
        </div>
        <button onClick={openNew}
          className="bg-brandit-orange text-white font-semibold px-6 py-3 rounded-xl text-sm hover:bg-brandit-orange/90 transition-colors shadow-sm">
          + Nuevo Lead
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-8">
        <button onClick={() => setFiltro("")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            filtro === "" ? "bg-brandit-orange text-white" : "text-gray-500 hover:text-brandit-black hover:bg-gray-50"
          }`}>
          Todos
        </button>
        {ESTADOS.map((e) => (
          <button key={e.value} onClick={() => setFiltro(e.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filtro === e.value ? "bg-brandit-orange text-white" : "text-gray-500 hover:text-brandit-black hover:bg-gray-50"
            }`}>
            {e.label}
          </button>
        ))}
      </div>

      {/* Form panel */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-50 p-6 mb-6">
          <h3 className="font-semibold text-brandit-black mb-4">{editingId ? "Editar Lead" : "Nuevo Lead"}</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input placeholder="Nombre *" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required
              className="bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brandit-orange/20 focus:border-brandit-orange/40 outline-none" />
            <input placeholder="Empresa" value={form.empresa} onChange={(e) => setForm({ ...form, empresa: e.target.value })}
              className="bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brandit-orange/20 focus:border-brandit-orange/40 outline-none" />
            <input placeholder="Teléfono" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })}
              className="bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brandit-orange/20 focus:border-brandit-orange/40 outline-none" />
            <input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brandit-orange/20 focus:border-brandit-orange/40 outline-none" />
            <select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value as Lead["estado"] })}
              className="bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brandit-orange/20 focus:border-brandit-orange/40 outline-none">
              {ESTADOS.map((e) => (
                <option key={e.value} value={e.value}>{e.label}</option>
              ))}
            </select>
            <input
              placeholder="Vendedora"
              value={form.vendedora}
              onChange={(e) => setForm({ ...form, vendedora: e.target.value })}
              readOnly={isVendedora}
              className={`bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brandit-orange/20 focus:border-brandit-orange/40 outline-none ${isVendedora ? "bg-gray-50 text-gray-500" : ""}`}
            />
          </div>
          <textarea placeholder="Notas" value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} rows={2}
            className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brandit-orange/20 focus:border-brandit-orange/40 outline-none mb-4" />
          <div className="flex gap-2">
            <button type="submit" disabled={saving}
              className="bg-brandit-orange text-white font-semibold px-6 py-2 rounded-xl text-sm hover:bg-brandit-orange/90 transition-colors disabled:opacity-50">
              {saving ? "Guardando..." : editingId ? "Actualizar" : "Guardar"}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }}
              className="text-sm text-gray-400 hover:text-gray-600 px-4 py-2">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* List */}
      {loading ? (
        <div className="text-center py-24 text-gray-300 text-lg">Cargando...</div>
      ) : leads.length === 0 ? (
        <div className="text-center py-24">
          <div className="text-6xl mb-4 opacity-20">👥</div>
          <p className="text-gray-400 text-lg mb-3">No hay leads</p>
          <button onClick={openNew} className="text-brandit-black font-medium hover:underline text-sm">Agregar el primer lead</button>
        </div>
      ) : (
        <div className="space-y-2">
          {leads.map((lead) => {
            const ei = estadoInfo(lead.estado);
            return (
              <div
                key={lead.id}
                onClick={() => canEdit(lead) && openEdit(lead)}
                className={`flex items-center justify-between bg-white rounded-2xl border px-5 py-4 hover:border-brandit-orange/10 hover:shadow-md transition-all group ${
                  canEdit(lead) ? "cursor-pointer" : ""
                } ${editingId === lead.id ? "border-brandit-orange/20 shadow-md" : "border-gray-50"}`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 font-bold text-xs group-hover:bg-brandit-orange/5 group-hover:text-brandit-black transition-colors">
                    {lead.nombre.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm group-hover:text-brandit-black transition-colors">
                      {lead.nombre}
                      {lead.empresa && <span className="text-gray-400 font-normal"> · {lead.empresa}</span>}
                    </h3>
                    <p className="text-xs text-gray-400">
                      {lead.vendedora && `${lead.vendedora} · `}
                      {lead.telefono || lead.email || "Sin contacto"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${ei?.bg} ${ei?.text}`}>
                    {ei?.label}
                  </span>
                  {canDelete(lead) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteLead(lead.id); }}
                      className="text-xs text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
