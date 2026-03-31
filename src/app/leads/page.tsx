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
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<LeadForm>({
    nombre: "", empresa: "", telefono: "", email: "", estado: "interesado", notas: "", vendedora: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");

  useEffect(() => {
    setRole(localStorage.getItem("brandit_role") || "");
    setUserEmail(localStorage.getItem("brandit_email") || "");
    setUserName(localStorage.getItem("brandit_nombre") || "");
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

  const filtered = leads.filter((l) =>
    !search ||
    l.nombre?.toLowerCase().includes(search.toLowerCase()) ||
    l.empresa?.toLowerCase().includes(search.toLowerCase())
  );

  const counts = {
    total: leads.length,
    interesado: leads.filter((l) => l.estado === "interesado").length,
    seguimiento: leads.filter((l) => l.estado === "seguimiento").length,
    no_interesado: leads.filter((l) => l.estado === "no_interesado").length,
  };

  const openNew = () => {
    setForm({
      nombre: "", empresa: "", telefono: "", email: "", estado: "interesado", notas: "",
      vendedora: isVendedora ? userName : "",
    });
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (lead: Lead) => {
    if (isVendedora && lead.vendedora !== userName && lead.vendedora !== userEmail) return;
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
    if (editingId === id) { setShowForm(false); setEditingId(null); }
    load();
  };

  const canDelete = (lead: Lead) => {
    if (role === "admin" || role === "secretaria") return true;
    if (isVendedora && (lead.vendedora === userEmail || lead.vendedora === userName)) return true;
    return false;
  };

  const canEdit = (lead: Lead) => {
    if (role === "admin" || role === "secretaria") return true;
    if (isVendedora && (lead.vendedora === userEmail || lead.vendedora === userName)) return true;
    return false;
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Ventas</p>
          <h1 className="text-3xl font-bold text-brandit-black tracking-tight">Leads</h1>
          <p className="text-sm text-gray-400 mt-1">Registro de clientes potenciales</p>
        </div>
        <button onClick={openNew}
          className="bg-brandit-orange text-white rounded-xl px-6 py-2.5 text-sm font-medium hover:bg-brandit-orange/90 transition-colors">
          + Nuevo Lead
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-2">Total Leads</p>
          <p className="text-3xl font-bold text-brandit-black">{counts.total}</p>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-2">Interesados</p>
          <p className="text-3xl font-bold text-green-600">{counts.interesado}</p>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-2">Seguimiento</p>
          <p className="text-3xl font-bold text-yellow-600">{counts.seguimiento}</p>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-2">No Interesados</p>
          <p className="text-3xl font-bold text-gray-400">{counts.no_interesado}</p>
        </div>
      </div>

      {/* Filters + Search */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <div className="flex gap-2">
          <button onClick={() => setFiltro("")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filtro === "" ? "bg-brandit-orange text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}>
            Todos
          </button>
          {ESTADOS.map((e) => (
            <button key={e.value} onClick={() => setFiltro(e.value)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filtro === e.value ? "bg-brandit-orange text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}>
              {e.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Buscar nombre o empresa..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border-b border-gray-200 py-2 text-sm outline-none focus:border-brandit-orange transition-colors bg-transparent w-64"
        />
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-4">
            {editingId ? "Editar Lead" : "Nuevo Lead"}
          </p>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 mb-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Nombre *</label>
                <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required
                  className="w-full border-b border-gray-200 py-2 text-sm outline-none focus:border-brandit-orange transition-colors bg-transparent" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Empresa</label>
                <input value={form.empresa} onChange={(e) => setForm({ ...form, empresa: e.target.value })}
                  className="w-full border-b border-gray-200 py-2 text-sm outline-none focus:border-brandit-orange transition-colors bg-transparent" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Telefono</label>
                <input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                  className="w-full border-b border-gray-200 py-2 text-sm outline-none focus:border-brandit-orange transition-colors bg-transparent" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full border-b border-gray-200 py-2 text-sm outline-none focus:border-brandit-orange transition-colors bg-transparent" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Estado</label>
                <select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value as Lead["estado"] })}
                  className="w-full border-b border-gray-200 py-2 text-sm outline-none focus:border-brandit-orange transition-colors bg-transparent">
                  {ESTADOS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Vendedora</label>
                <input
                  value={form.vendedora}
                  onChange={(e) => setForm({ ...form, vendedora: e.target.value })}
                  readOnly={isVendedora}
                  className={`w-full border-b border-gray-200 py-2 text-sm outline-none focus:border-brandit-orange transition-colors bg-transparent ${isVendedora ? "text-gray-400" : ""}`}
                />
              </div>
            </div>
            <div className="mb-4">
              <label className="text-xs text-gray-400 block mb-1">Notas</label>
              <textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} rows={2}
                className="w-full border-b border-gray-200 py-2 text-sm outline-none focus:border-brandit-orange transition-colors bg-transparent resize-none" />
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={saving}
                className="bg-brandit-orange text-white rounded-xl px-6 py-2.5 text-sm font-medium hover:bg-brandit-orange/90 transition-colors disabled:opacity-50">
                {saving ? "Guardando..." : editingId ? "Actualizar" : "Guardar"}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }}
                className="border border-gray-200 text-gray-600 rounded-xl px-4 py-2 text-sm hover:border-gray-300 transition-colors">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="text-center py-24 text-gray-300">Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24">
          <p className="text-gray-300 text-lg mb-2">
            {search || filtro ? "Sin resultados" : "No hay leads"}
          </p>
          {!search && !filtro && (
            <button onClick={openNew} className="text-brandit-orange font-medium hover:underline text-sm">
              Agregar el primer lead
            </button>
          )}
        </div>
      ) : (
        <div>
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-4">
            {filtered.length} lead{filtered.length !== 1 ? "s" : ""}
          </p>
          <div className="space-y-3">
            {filtered.map((lead) => {
              const ei = estadoInfo(lead.estado);
              return (
                <div
                  key={lead.id}
                  onClick={() => canEdit(lead) && openEdit(lead)}
                  className={`bg-white rounded-2xl border px-6 py-5 hover:border-brandit-orange/20 hover:shadow-md transition-all group ${
                    canEdit(lead) ? "cursor-pointer" : ""
                  } ${editingId === lead.id ? "border-brandit-orange/30 shadow-md" : "border-gray-100"}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-brandit-orange/10 flex items-center justify-center text-brandit-orange font-bold text-sm">
                        {lead.nombre?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 text-sm group-hover:text-brandit-black transition-colors">
                          {lead.nombre}
                          {lead.empresa && <span className="text-gray-400 font-normal"> · {lead.empresa}</span>}
                        </h3>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {lead.vendedora && <span className="text-brandit-orange/70">{lead.vendedora}</span>}
                          {lead.vendedora && (lead.telefono || lead.email) && " · "}
                          {lead.telefono || lead.email || (!lead.vendedora && "Sin contacto")}
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
                          Eliminar
                        </button>
                      )}
                    </div>
                  </div>
                  {lead.notas && (
                    <p className="text-xs text-gray-400 mt-2 pl-14 line-clamp-1">{lead.notas}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
