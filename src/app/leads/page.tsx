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
  fecha_seguimiento: string | null;
  asignado_a: string | null;
  created_at: string;
};

type Comentario = {
  id: string;
  lead_id: string;
  comentario: string;
  autor: string;
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
  fecha_seguimiento: string;
  asignado_a: string;
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<LeadForm>({
    nombre: "", empresa: "", telefono: "", email: "", estado: "interesado", notas: "", vendedora: "", fecha_seguimiento: "", asignado_a: "",
  });
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showPanel, setShowPanel] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [newComment, setNewComment] = useState("");
  const [addingComment, setAddingComment] = useState(false);

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

  const loadComentarios = async (leadId: string) => {
    const res = await fetch(`/api/leads/${leadId}/comentarios`);
    const data = await res.json();
    setComentarios(Array.isArray(data) ? data : []);
  };

  const addComentario = async () => {
    if (!newComment.trim() || !selectedLead) return;
    setAddingComment(true);
    await fetch(`/api/leads/${selectedLead.id}/comentarios`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comentario: newComment.trim(), autor: userName || userEmail }),
    });
    setNewComment("");
    setAddingComment(false);
    loadComentarios(selectedLead.id);
  };

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

  const today = new Date().toISOString().split("T")[0];

  const isSeguimientoDue = (lead: Lead) => {
    return lead.fecha_seguimiento && lead.fecha_seguimiento <= today;
  };

  const openNew = () => {
    setForm({
      nombre: "", empresa: "", telefono: "", email: "", estado: "interesado", notas: "",
      vendedora: isVendedora ? userName : "", fecha_seguimiento: "", asignado_a: "",
    });
    setShowNewForm(true);
    setShowPanel(false);
    setSelectedLead(null);
  };

  const openPanel = (lead: Lead) => {
    if (!canEdit(lead)) return;
    setSelectedLead(lead);
    setForm({
      nombre: lead.nombre || "",
      empresa: lead.empresa || "",
      telefono: lead.telefono || "",
      email: lead.email || "",
      estado: lead.estado,
      notas: lead.notas || "",
      vendedora: lead.vendedora || "",
      fecha_seguimiento: lead.fecha_seguimiento || "",
      asignado_a: lead.asignado_a || "",
    });
    setShowPanel(true);
    setShowNewForm(false);
    loadComentarios(lead.id);
  };

  const closePanel = () => {
    setShowPanel(false);
    setSelectedLead(null);
    setComentarios([]);
    setNewComment("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    if (selectedLead) {
      await fetch(`/api/leads/${selectedLead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      closePanel();
    } else {
      await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setShowNewForm(false);
    }
    setSaving(false);
    load();
  };

  const deleteLead = async (id: string) => {
    if (!confirm("¿Eliminar este lead?")) return;
    await fetch(`/api/leads/${id}`, { method: "DELETE" });
    if (selectedLead?.id === id) closePanel();
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

  const formatDate = (d: string) => {
    const date = new Date(d + "T00:00:00");
    return date.toLocaleDateString("es-PA", { day: "numeric", month: "short" });
  };

  const formatDateTime = (d: string) => {
    return new Date(d).toLocaleDateString("es-PA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  const renderForm = (isNew: boolean) => (
    <form onSubmit={handleSubmit}>
      <div className="space-y-4 mb-4">
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
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Teléfono</label>
            <input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })}
              className="w-full border-b border-gray-200 py-2 text-sm outline-none focus:border-brandit-orange transition-colors bg-transparent" />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full border-b border-gray-200 py-2 text-sm outline-none focus:border-brandit-orange transition-colors bg-transparent" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
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
        <div>
          <label className="text-xs text-gray-400 block mb-1">Fecha de Seguimiento</label>
          <input type="date" value={form.fecha_seguimiento} onChange={(e) => setForm({ ...form, fecha_seguimiento: e.target.value })}
            className="w-full border-b border-gray-200 py-2 text-sm outline-none focus:border-brandit-orange transition-colors bg-transparent" />
        </div>
        {!isVendedora && (
          <div>
            <label className="text-xs text-gray-400 block mb-1">Asignado a</label>
            <input value={form.asignado_a} onChange={(e) => setForm({ ...form, asignado_a: e.target.value })}
              placeholder="Nombre de la persona asignada"
              className="w-full border-b border-gray-200 py-2 text-sm outline-none focus:border-brandit-orange transition-colors bg-transparent" />
          </div>
        )}
        <div>
          <label className="text-xs text-gray-400 block mb-1">Notas</label>
          <textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} rows={2}
            className="w-full border-b border-gray-200 py-2 text-sm outline-none focus:border-brandit-orange transition-colors bg-transparent resize-none" />
        </div>
      </div>
      <div className="flex gap-3">
        <button type="submit" disabled={saving}
          className="bg-brandit-orange text-white rounded-xl px-6 py-2.5 text-sm font-medium hover:bg-brandit-orange/90 transition-colors disabled:opacity-50">
          {saving ? "Guardando..." : isNew ? "Guardar" : "Actualizar"}
        </button>
        <button type="button" onClick={() => isNew ? setShowNewForm(false) : closePanel()}
          className="border border-gray-200 text-gray-600 rounded-xl px-4 py-2 text-sm hover:border-gray-300 transition-colors">
          Cancelar
        </button>
      </div>
    </form>
  );

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

      {/* New Lead Form (inline) */}
      {showNewForm && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-4">Nuevo Lead</p>
          {renderForm(true)}
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
              const due = isSeguimientoDue(lead);
              return (
                <div
                  key={lead.id}
                  onClick={() => openPanel(lead)}
                  className={`bg-white rounded-2xl border px-6 py-5 hover:border-brandit-orange/20 hover:shadow-md transition-all group ${
                    canEdit(lead) ? "cursor-pointer" : ""
                  } ${selectedLead?.id === lead.id ? "border-brandit-orange/30 shadow-md" : "border-gray-100"}`}
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
                          {lead.asignado_a && <span className="ml-2 text-gray-400">→ {lead.asignado_a}</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {due && (
                        <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-brandit-orange/10 text-brandit-orange">
                          Seguimiento {lead.fecha_seguimiento ? formatDate(lead.fecha_seguimiento) : ""}
                        </span>
                      )}
                      {!due && lead.fecha_seguimiento && (
                        <span className="text-[10px] text-gray-400">
                          {formatDate(lead.fecha_seguimiento)}
                        </span>
                      )}
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

      {/* Slide-over Panel */}
      {showPanel && selectedLead && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/30 z-40" onClick={closePanel} />

          {/* Panel */}
          <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col">
            {/* Panel header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-gray-400">Detalle del Lead</p>
                <h2 className="text-lg font-bold text-brandit-black">{selectedLead.nombre}</h2>
              </div>
              <button onClick={closePanel} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>

            {/* Panel content */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {/* Edit form */}
              <div className="mb-6">
                <p className="text-xs uppercase tracking-widest text-gray-400 mb-4">Información</p>
                {renderForm(false)}
              </div>

              {/* Comments section */}
              <div className="border-t border-gray-100 pt-6">
                <p className="text-xs uppercase tracking-widest text-gray-400 mb-4">
                  Comentarios ({comentarios.length})
                </p>

                {/* Add comment */}
                <div className="flex gap-2 mb-4">
                  <input
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Agregar comentario..."
                    className="flex-1 border-b border-gray-200 py-2 text-sm outline-none focus:border-brandit-orange transition-colors bg-transparent"
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && addComentario()}
                  />
                  <button
                    onClick={addComentario}
                    disabled={addingComment || !newComment.trim()}
                    className="bg-brandit-orange text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-brandit-orange/90 disabled:opacity-50 transition-colors"
                  >
                    {addingComment ? "..." : "Enviar"}
                  </button>
                </div>

                {/* Comments list */}
                <div className="space-y-3">
                  {comentarios.map((c) => (
                    <div key={c.id} className="bg-gray-50 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-brandit-black">{c.autor}</span>
                        <span className="text-[10px] text-gray-400">{formatDateTime(c.created_at)}</span>
                      </div>
                      <p className="text-sm text-gray-700">{c.comentario}</p>
                    </div>
                  ))}
                  {comentarios.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">Sin comentarios</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
