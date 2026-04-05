"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Avatar from "@/components/Avatar";

type Lead = {
  id: string;
  nombre: string;
  empresa: string;
  telefono: string;
  email: string;
  estado: string;
  estado_venta: string;
  notas: string;
  vendedora: string;
  empresa_vendedora: string | null;
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

const ESTADOS_PROSPECTO = [
  { value: "prospecto", label: "Prospecto", bg: "bg-green-50", text: "text-green-600" },
  { value: "no_califica", label: "No califica", bg: "bg-gray-100", text: "text-gray-500" },
] as const;

const ESTADOS_VENTA: Record<string, { bg: string; text: string; label: string }> = {
  convertido: { bg: "bg-green-100", text: "text-green-700", label: "Convertido" },
  no_convertido: { bg: "bg-red-50", text: "text-red-400", label: "No convertido" },
};

// Map legacy DB values to new display values
function normalizeEstado(estado: string): string {
  if (estado === "interesado") return "prospecto";
  if (estado === "no_interesado") return "no_califica";
  return estado;
}

function normalizeEstadoVenta(ev: string): string {
  if (ev === "perdido") return "no_convertido";
  return ev;
}

type LeadForm = {
  nombre: string;
  empresa: string;
  telefono: string;
  email: string;
  estado: string;
  estado_venta: string;
  notas: string;
  vendedora: string;
  fecha_seguimiento: string;
  asignado_a: string;
};

type ViewMode = "lista" | "kanban";

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<LeadForm>({
    nombre: "", empresa: "", telefono: "", email: "", estado: "prospecto",
    estado_venta: "activo", notas: "", vendedora: "", fecha_seguimiento: "", asignado_a: "",
  });
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showPanel, setShowPanel] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [userEmpresa, setUserEmpresa] = useState("");
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [newComment, setNewComment] = useState("");
  const [addingComment, setAddingComment] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [empresaTab, setEmpresaTab] = useState<string>("todas");
  const [viewMode, setViewMode] = useState<ViewMode>("lista");
  const [kanbanTab, setKanbanTab] = useState<"prospectos" | "convertidos" | "no_convertidos">("prospectos");

  useEffect(() => {
    setRole(localStorage.getItem("brandit_role") || "");
    setUserEmail(localStorage.getItem("brandit_email") || "");
    setUserName(localStorage.getItem("brandit_nombre") || "");
    setUserEmpresa(localStorage.getItem("brandit_empresa") || "");
  }, []);

  const isVendedora = role === "vendedora";

  const load = useCallback(async () => {
    if (!role) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (isVendedora && userEmpresa) params.set("empresa", userEmpresa);
    const res = await fetch(`/api/leads?${params}`);
    const data = await res.json();
    setLeads(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [role, isVendedora, userEmpresa]);

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

  const prospectoInfo = (estado: string) => {
    const normalized = normalizeEstado(estado);
    return ESTADOS_PROSPECTO.find((e) => e.value === normalized) || ESTADOS_PROSPECTO[0];
  };

  // Filtering — empresa tabs filter by empresa_vendedora
  const filteredByEmpresa = !isVendedora && empresaTab !== "todas"
    ? leads.filter((l) => l.empresa_vendedora === empresaTab)
    : leads;

  const filteredByFiltro = filteredByEmpresa.filter((l) => {
    if (!filtro) return true;
    const ne = normalizeEstado(l.estado);
    const nv = normalizeEstadoVenta(l.estado_venta);
    if (filtro === "prospecto") return ne === "prospecto";
    if (filtro === "no_califica") return ne === "no_califica";
    if (filtro === "convertido") return nv === "convertido";
    if (filtro === "no_convertido") return nv === "no_convertido";
    return true;
  });

  const filtered = filteredByFiltro.filter((l) =>
    !search ||
    l.nombre?.toLowerCase().includes(search.toLowerCase()) ||
    l.empresa?.toLowerCase().includes(search.toLowerCase())
  );

  const counts = {
    total: filteredByEmpresa.length,
    prospecto: filteredByEmpresa.filter((l) => normalizeEstado(l.estado) === "prospecto").length,
    no_califica: filteredByEmpresa.filter((l) => normalizeEstado(l.estado) === "no_califica").length,
    convertido: filteredByEmpresa.filter((l) => normalizeEstadoVenta(l.estado_venta) === "convertido").length,
  };

  const today = new Date().toISOString().split("T")[0];

  const isSeguimientoDue = (lead: Lead) => lead.fecha_seguimiento && lead.fecha_seguimiento <= today;

  const openNew = () => {
    setForm({
      nombre: "", empresa: "", telefono: "", email: "", estado: "prospecto",
      estado_venta: "activo", notas: "",
      vendedora: userName || "",
      fecha_seguimiento: "", asignado_a: "",
    });
    setShowNewForm(true);
    setShowPanel(false);
    setSelectedLead(null);
    setEditMode(false);
  };

  const openPanel = (lead: Lead) => {
    setSelectedLead(lead);
    setForm({
      nombre: lead.nombre || "",
      empresa: lead.empresa || "",
      telefono: lead.telefono || "",
      email: lead.email || "",
      estado: normalizeEstado(lead.estado),
      estado_venta: normalizeEstadoVenta(lead.estado_venta || "activo"),
      notas: lead.notas || "",
      vendedora: lead.vendedora || "",
      fecha_seguimiento: lead.fecha_seguimiento || "",
      asignado_a: lead.asignado_a || "",
    });
    setShowPanel(true);
    setShowNewForm(false);
    setEditMode(false);
    loadComentarios(lead.id);
  };

  const closePanel = () => {
    setShowPanel(false);
    setSelectedLead(null);
    setComentarios([]);
    setNewComment("");
    setEditMode(false);
  };

  const handleSubmitNew = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, empresa_vendedora: userEmpresa }),
    });
    setShowNewForm(false);
    setSaving(false);
    load();
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;
    setSaving(true);
    await fetch(`/api/leads/${selectedLead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setEditMode(false);
    closePanel();
    load();
  };

  const updateEstadoVenta = async (lead: Lead, estado_venta: string) => {
    await fetch(`/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado_venta }),
    });
    load();
    if (selectedLead?.id === lead.id) {
      setSelectedLead({ ...lead, estado_venta });
    }
  };

  const deleteLead = async (id: string) => {
    if (!confirm("¿Seguro que quieres eliminar este lead?")) return;
    await fetch(`/api/leads/${id}`, { method: "DELETE" });
    if (selectedLead?.id === id) closePanel();
    load();
  };

  const canDelete = !isVendedora;

  const formatDate = (d: string) => {
    const date = new Date(d + "T00:00:00");
    return date.toLocaleDateString("es-PA", { day: "numeric", month: "short" });
  };

  const formatDateTime = (d: string) => {
    return new Date(d).toLocaleDateString("es-PA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  // Helper: is this lead a prospecto with active sale status?
  const isProspectoActivo = (lead: Lead) =>
    normalizeEstado(lead.estado) === "prospecto" && normalizeEstadoVenta(lead.estado_venta || "activo") === "activo";

  // Kanban columns
  const kanbanProspectos = filteredByEmpresa.filter((l) =>
    normalizeEstado(l.estado) === "prospecto" && normalizeEstadoVenta(l.estado_venta || "activo") === "activo"
  );
  const kanbanConvertidos = filteredByEmpresa.filter((l) =>
    normalizeEstadoVenta(l.estado_venta) === "convertido"
  );
  const kanbanNoConvertidos = filteredByEmpresa.filter((l) =>
    normalizeEstadoVenta(l.estado_venta) === "no_convertido"
  );

  const KanbanCard = ({ lead }: { lead: Lead }) => (
    <div
      onClick={() => openPanel(lead)}
      className="bg-white border border-gray-100 rounded-xl px-3.5 py-3 cursor-pointer hover:shadow-md transition-all"
    >
      <h4 className="font-semibold text-sm text-gray-900 truncate">{lead.nombre}</h4>
      {lead.empresa && <p className="text-xs text-gray-400 mt-0.5 truncate">{lead.empresa}</p>}
      <div className="flex items-center gap-2 mt-2">
        {lead.telefono && (
          <a href={`tel:${lead.telefono}`} onClick={(e) => e.stopPropagation()}
            className="text-xs text-brandit-orange truncate">
            {lead.telefono}
          </a>
        )}
      </div>
      {lead.vendedora && <p className="text-[10px] text-gray-400 mt-1">{lead.vendedora}</p>}
    </div>
  );

  const KanbanColumn = ({ title, leads: colLeads, color, countBg }: { title: string; leads: Lead[]; color: string; countBg: string }) => (
    <div className="flex-1 min-w-[280px] flex flex-col min-h-0">
      <div className={`flex items-center gap-2 mb-3 px-1`}>
        <h3 className={`text-sm font-bold ${color}`}>{title}</h3>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${countBg}`}>{colLeads.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 pb-4">
        {colLeads.map((l) => <KanbanCard key={l.id} lead={l} />)}
        {colLeads.length === 0 && (
          <p className="text-center text-gray-300 text-xs py-8">Sin leads</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="bg-white min-h-screen">
      <div className={`mx-auto px-4 py-6 ${viewMode === "kanban" ? "max-w-6xl" : "max-w-2xl"}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-2xl font-bold text-brandit-black tracking-tight">Leads</h1>
          <div className="flex items-center gap-2">
            {!isVendedora && (
              <>
                <Link href="/leads/reporte" className="text-xs text-brandit-orange hover:underline mr-2">
                  Reporte
                </Link>
                <Link href="/leads/calendario" className="text-xs text-brandit-orange hover:underline mr-2">
                  Calendario
                </Link>
              </>
            )}
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              <button onClick={() => setViewMode("lista")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === "lista" ? "bg-white text-brandit-black shadow-sm" : "text-gray-500"}`}>
                Lista
              </button>
              <button onClick={() => setViewMode("kanban")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === "kanban" ? "bg-white text-brandit-black shadow-sm" : "text-gray-500"}`}>
                Kanban
              </button>
            </div>
          </div>
        </div>

        {/* KPI row - horizontal scrollable */}
        <div className="flex gap-3 overflow-x-auto pb-3 mb-4 -mx-4 px-4 scrollbar-hide">
          {[
            { label: "Total", value: counts.total, color: "text-brandit-black" },
            { label: "Prospectos", value: counts.prospecto, color: "text-green-600" },
            { label: "No califica", value: counts.no_califica, color: "text-gray-500" },
            { label: "Convertidos", value: counts.convertido, color: "text-green-700" },
          ].map((k) => (
            <div key={k.label} className="bg-gray-50 rounded-xl px-4 py-3 min-w-[100px] flex-shrink-0">
              <p className="text-[10px] uppercase tracking-widest text-gray-400">{k.label}</p>
              <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* Empresa tabs (admin/secretaria only) */}
        {!isVendedora && (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
            {[
              { key: "todas", label: "Todas" },
              { key: "confecciones_boston", label: "Confecciones Boston" },
              { key: "brand_it", label: "Brand It" },
            ].map((t) => (
              <button key={t.key} onClick={() => setEmpresaTab(t.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                  empresaTab === t.key ? "bg-brandit-black text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}>
                {t.label}
              </button>
            ))}
          </div>
        )}

        {viewMode === "lista" && (
          <>
            {/* Filter pills */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
              {[
                { key: "", label: "Todos" },
                { key: "prospecto", label: "Prospecto" },
                { key: "no_califica", label: "No califica" },
                { key: "convertido", label: "Convertido" },
                { key: "no_convertido", label: "No convertido" },
              ].map((f) => (
                <button key={f.key} onClick={() => setFiltro(f.key)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                    filtro === f.key ? "bg-brandit-orange text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}>
                  {f.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <input
              type="text"
              placeholder="Buscar por nombre o empresa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brandit-orange/20 mb-4"
            />

            {/* Lead cards */}
            {loading ? (
              <div className="text-center py-24 text-gray-300">Cargando...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-24">
                <p className="text-gray-300 text-lg mb-2">
                  {search || filtro ? "No se encontraron leads" : "Todav\u00eda no hay leads registrados"}
                </p>
              </div>
            ) : (
              <div className="space-y-2 pb-24">
                {filtered.map((lead) => {
                  const pi = prospectoInfo(lead.estado);
                  const due = isSeguimientoDue(lead);
                  const nev = normalizeEstadoVenta(lead.estado_venta || "activo");
                  const vi = ESTADOS_VENTA[nev];
                  return (
                    <div
                      key={lead.id}
                      onClick={() => openPanel(lead)}
                      className="bg-white border border-gray-100 rounded-xl px-4 py-3.5 active:bg-gray-50 transition-all duration-150 active:scale-[0.98] cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Avatar nombre={lead.nombre} size="sm" />
                            <h3 className="font-semibold text-gray-900 text-sm truncate">{lead.nombre}</h3>
                            {due && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-600 flex-shrink-0">
                                Seguimiento
                              </span>
                            )}
                          </div>
                          {lead.empresa && <p className="text-xs text-gray-400 mt-0.5">{lead.empresa}</p>}
                          <div className="flex items-center gap-2 mt-1.5">
                            {lead.telefono && (
                              <a href={`tel:${lead.telefono}`} onClick={(e) => e.stopPropagation()}
                                className="text-xs text-brandit-orange">
                                {lead.telefono}
                              </a>
                            )}
                            {lead.vendedora && <span className="text-[10px] text-gray-400">{lead.vendedora}</span>}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${pi.bg} ${pi.text}`}>
                            {pi.label}
                          </span>
                          {vi && (
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${vi.bg} ${vi.text}`}>
                              {vi.label}
                            </span>
                          )}
                          {isProspectoActivo(lead) && (
                            <button
                              onClick={(e) => { e.stopPropagation(); updateEstadoVenta(lead, "convertido"); }}
                              className="text-[10px] font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full hover:bg-green-100 transition-colors"
                            >
                              Convertido
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {viewMode === "kanban" && (
          <>
            {loading ? (
              <div className="text-center py-24 text-gray-300">Cargando...</div>
            ) : (
              <>
                {/* Mobile: tabs */}
                <div className="md:hidden flex gap-2 mb-4">
                  {([
                    { key: "prospectos" as const, label: "Prospectos", count: kanbanProspectos.length },
                    { key: "convertidos" as const, label: "Convertidos", count: kanbanConvertidos.length },
                    { key: "no_convertidos" as const, label: "No convertidos", count: kanbanNoConvertidos.length },
                  ]).map((t) => (
                    <button key={t.key} onClick={() => setKanbanTab(t.key)}
                      className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors ${
                        kanbanTab === t.key ? "bg-brandit-orange text-white" : "bg-gray-100 text-gray-500"
                      }`}>
                      {t.label} ({t.count})
                    </button>
                  ))}
                </div>
                <div className="md:hidden pb-24">
                  {kanbanTab === "prospectos" && (
                    <div className="space-y-2">
                      {kanbanProspectos.map((l) => <KanbanCard key={l.id} lead={l} />)}
                      {kanbanProspectos.length === 0 && <p className="text-center text-gray-300 text-xs py-8">Sin leads</p>}
                    </div>
                  )}
                  {kanbanTab === "convertidos" && (
                    <div className="space-y-2">
                      {kanbanConvertidos.map((l) => <KanbanCard key={l.id} lead={l} />)}
                      {kanbanConvertidos.length === 0 && <p className="text-center text-gray-300 text-xs py-8">Sin leads</p>}
                    </div>
                  )}
                  {kanbanTab === "no_convertidos" && (
                    <div className="space-y-2">
                      {kanbanNoConvertidos.map((l) => <KanbanCard key={l.id} lead={l} />)}
                      {kanbanNoConvertidos.length === 0 && <p className="text-center text-gray-300 text-xs py-8">Sin leads</p>}
                    </div>
                  )}
                </div>

                {/* Desktop: 3 columns */}
                <div className="hidden md:flex gap-4 pb-8" style={{ height: "calc(100vh - 320px)" }}>
                  <KanbanColumn
                    title="Prospectos"
                    leads={kanbanProspectos}
                    color="text-brandit-orange"
                    countBg="bg-orange-100 text-brandit-orange"
                  />
                  <KanbanColumn
                    title="Convertidos"
                    leads={kanbanConvertidos}
                    color="text-green-600"
                    countBg="bg-green-100 text-green-700"
                  />
                  <KanbanColumn
                    title="No convertidos"
                    leads={kanbanNoConvertidos}
                    color="text-gray-500"
                    countBg="bg-gray-200 text-gray-600"
                  />
                </div>
              </>
            )}
          </>
        )}

        {/* FAB - New Lead */}
        <button
          onClick={openNew}
          className="fixed bottom-6 right-6 w-14 h-14 bg-brandit-orange text-white rounded-full shadow-lg hover:bg-brandit-orange/90 active:scale-95 transition-all flex items-center justify-center text-2xl font-light z-30"
        >
          +
        </button>
      </div>

      {/* Bottom Sheet: New Lead */}
      {showNewForm && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setShowNewForm(false)} />
          <div className="fixed inset-x-0 bottom-0 md:inset-y-0 md:right-0 md:left-auto md:w-full md:max-w-lg bg-white rounded-t-2xl md:rounded-none shadow-2xl z-50 flex flex-col max-h-[90vh] md:max-h-full">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-brandit-black">Nuevo Lead</h2>
              <button onClick={() => setShowNewForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <form onSubmit={handleSubmitNew} className="flex-1 overflow-y-auto px-5 py-4">
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Nombre *</label>
                  <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required
                    className="w-full border-b border-gray-200 py-2 text-sm outline-none focus:border-brandit-orange transition-colors bg-transparent" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Empresa *</label>
                  <input value={form.empresa} onChange={(e) => setForm({ ...form, empresa: e.target.value })} required
                    className="w-full border-b border-gray-200 py-2 text-sm outline-none focus:border-brandit-orange transition-colors bg-transparent" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Teléfono *</label>
                  <input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} required
                    className="w-full border-b border-gray-200 py-2 text-sm outline-none focus:border-brandit-orange transition-colors bg-transparent" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Email</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full border-b border-gray-200 py-2 text-sm outline-none focus:border-brandit-orange transition-colors bg-transparent" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-2">Estado</label>
                  <div className="flex gap-2">
                    {ESTADOS_PROSPECTO.map((e) => (
                      <button key={e.value} type="button"
                        onClick={() => setForm({ ...form, estado: e.value })}
                        className={`flex-1 py-3 rounded-xl text-sm font-medium transition-colors ${
                          form.estado === e.value
                            ? "bg-brandit-orange text-white"
                            : "bg-gray-100 text-gray-500"
                        }`}>
                        {e.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Notas *</label>
                  <textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} rows={3} required
                    className="w-full border-b border-gray-200 py-2 text-sm outline-none focus:border-brandit-orange transition-colors bg-transparent resize-none" />
                </div>
              </div>
              <div className="mt-6 pb-4">
                <button type="submit" disabled={saving}
                  className="w-full bg-brandit-orange text-white rounded-xl py-3 text-sm font-medium hover:bg-brandit-orange/90 transition-colors disabled:opacity-50">
                  {saving ? "Guardando..." : "Guardar Lead"}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* Panel: Lead Detail */}
      {showPanel && selectedLead && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={closePanel} />
          <div className="fixed inset-x-0 bottom-0 md:inset-y-0 md:right-0 md:left-auto md:w-full md:max-w-lg bg-white rounded-t-2xl md:rounded-none shadow-2xl z-50 flex flex-col max-h-[90vh] md:max-h-full">
            {/* Panel header */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-gray-400">Lead</p>
                <h2 className="text-lg font-bold text-brandit-black">{selectedLead.nombre}</h2>
              </div>
              <button onClick={closePanel} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {!editMode ? (
                <>
                  {/* Read-only info */}
                  <div className="space-y-3 mb-5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${prospectoInfo(selectedLead.estado).bg} ${prospectoInfo(selectedLead.estado).text}`}>
                        {prospectoInfo(selectedLead.estado).label}
                      </span>
                      {ESTADOS_VENTA[normalizeEstadoVenta(selectedLead.estado_venta || "activo")] && (
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${ESTADOS_VENTA[normalizeEstadoVenta(selectedLead.estado_venta || "activo")].bg} ${ESTADOS_VENTA[normalizeEstadoVenta(selectedLead.estado_venta || "activo")].text}`}>
                          {ESTADOS_VENTA[normalizeEstadoVenta(selectedLead.estado_venta || "activo")].label}
                        </span>
                      )}
                    </div>
                    {selectedLead.empresa && (
                      <div><p className="text-xs text-gray-400">Empresa</p><p className="text-sm">{selectedLead.empresa}</p></div>
                    )}
                    {selectedLead.telefono && (
                      <div><p className="text-xs text-gray-400">Teléfono</p><a href={`tel:${selectedLead.telefono}`} className="text-sm text-brandit-orange">{selectedLead.telefono}</a></div>
                    )}
                    {selectedLead.email && (
                      <div><p className="text-xs text-gray-400">Email</p><p className="text-sm">{selectedLead.email}</p></div>
                    )}
                    {selectedLead.vendedora && (
                      <div><p className="text-xs text-gray-400">Vendedora</p><p className="text-sm">{selectedLead.vendedora}</p></div>
                    )}
                    {selectedLead.notas && (
                      <div><p className="text-xs text-gray-400">Notas</p><p className="text-sm text-gray-700">{selectedLead.notas}</p></div>
                    )}
                    {selectedLead.fecha_seguimiento && (
                      <div><p className="text-xs text-gray-400">Seguimiento</p><p className="text-sm">{formatDate(selectedLead.fecha_seguimiento)}</p></div>
                    )}
                    {selectedLead.asignado_a && (
                      <div><p className="text-xs text-gray-400">Asignado a</p><p className="text-sm">{selectedLead.asignado_a}</p></div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-2 mb-6">
                    <button onClick={() => setEditMode(true)}
                      className="bg-brandit-orange text-white rounded-xl px-4 py-2 text-sm font-medium">
                      Editar
                    </button>
                    {isProspectoActivo(selectedLead) && (
                      <>
                        <button onClick={() => { updateEstadoVenta(selectedLead, "convertido"); closePanel(); }}
                          className="bg-green-500 text-white rounded-xl px-4 py-2 text-sm font-medium">
                          Convertido
                        </button>
                        <button onClick={() => { updateEstadoVenta(selectedLead, "no_convertido"); closePanel(); }}
                          className="bg-red-400 text-white rounded-xl px-4 py-2 text-sm font-medium">
                          No Convertido
                        </button>
                      </>
                    )}
                    {canDelete && (
                      <button onClick={() => deleteLead(selectedLead.id)}
                        className="border border-red-200 text-red-500 rounded-xl px-4 py-2 text-sm hover:bg-red-50 transition-colors">
                        Eliminar
                      </button>
                    )}
                  </div>
                </>
              ) : (
                /* Edit form */
                <form onSubmit={handleSubmitEdit} className="mb-6">
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
                    <div>
                      <label className="text-xs text-gray-400 block mb-2">Estado</label>
                      <div className="flex gap-2">
                        {ESTADOS_PROSPECTO.map((e) => (
                          <button key={e.value} type="button"
                            onClick={() => setForm({ ...form, estado: e.value })}
                            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                              form.estado === e.value ? "bg-brandit-orange text-white" : "bg-gray-100 text-gray-500"
                            }`}>
                            {e.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Vendedora</label>
                      <input value={form.vendedora} onChange={(e) => setForm({ ...form, vendedora: e.target.value })}
                        readOnly={isVendedora}
                        className={`w-full border-b border-gray-200 py-2 text-sm outline-none focus:border-brandit-orange transition-colors bg-transparent ${isVendedora ? "text-gray-400" : ""}`} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Pr\u00f3ximo seguimiento</label>
                      <input type="date" value={form.fecha_seguimiento} onChange={(e) => setForm({ ...form, fecha_seguimiento: e.target.value })}
                        className="w-full border-b border-gray-200 py-2 text-sm outline-none focus:border-brandit-orange transition-colors bg-transparent" />
                    </div>
                    {!isVendedora && (
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Asignado a</label>
                        <input value={form.asignado_a} onChange={(e) => setForm({ ...form, asignado_a: e.target.value })}
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
                      {saving ? "Guardando..." : "Actualizar"}
                    </button>
                    <button type="button" onClick={() => setEditMode(false)}
                      className="border border-gray-200 text-gray-600 rounded-xl px-4 py-2 text-sm hover:border-gray-300 transition-colors">
                      Cancelar
                    </button>
                  </div>
                </form>
              )}

              {/* Comments section */}
              <div className="border-t border-gray-100 pt-5">
                <p className="text-xs uppercase tracking-widest text-gray-400 mb-4">
                  Comentarios ({comentarios.length})
                </p>

                <div className="flex gap-2 mb-4">
                  <input
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Agregar comentario..."
                    className="flex-1 bg-gray-50 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brandit-orange/20"
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

                <div className="space-y-2 pb-4">
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
                    <p className="text-sm text-gray-400 text-center py-4">No hay comentarios a\u00fan</p>
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
