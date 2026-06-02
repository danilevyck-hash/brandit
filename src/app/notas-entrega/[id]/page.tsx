"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useToast } from "@/components/Toast";
import { generateNotaPDF } from "@/lib/pdf-nota-entrega";

type NotaItem = {
  id: number;
  marca: string | null;
  descripcion: string;
  color: string | null;
  talla: string | null;
  cantidad: number;
  sort_order: number;
};

type Nota = {
  id: number;
  numero: string;
  tipo: "muestras" | "pedido" | null;
  fecha: string;
  cliente: string;
  contacto: string | null;
  numero_contacto: string | null;
  atencion: string | null;
  estado: string;
  aprobado_por: string | null;
  aprobado_at: string | null;
  scan_url: string | null;
  cerrada_at: string | null;
  created_by: string | null;
  created_at: string;
  items: NotaItem[];
};

function formatFecha(d: string) {
  if (!d) return "-";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function estadoBadge(estado: string) {
  switch (estado) {
    case "pendiente":
      return "bg-amber-100 text-amber-700";
    case "abierta":
      return "bg-gray-100 text-gray-600";
    case "cerrada":
      return "bg-green-100 text-green-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

export default function NotaDetallePage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const id = params.id as string;

  const [nota, setNota] = useState<Nota | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCerrarModal, setShowCerrarModal] = useState(false);
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [closing, setClosing] = useState(false);
  const [role, setRole] = useState("");
  const [aprobando, setAprobando] = useState(false);

  // Editing state
  const [editing, setEditing] = useState(false);
  const [editTipo, setEditTipo] = useState<"muestras" | "pedido">("pedido");
  const [editCliente, setEditCliente] = useState("");
  const [editContacto, setEditContacto] = useState("");
  const [editNumero, setEditNumero] = useState("");
  const [editAtencion, setEditAtencion] = useState("");
  const [editFecha, setEditFecha] = useState("");
  const [editItems, setEditItems] = useState<{ marca: string; descripcion: string; color: string; talla: string; cantidad: number }[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/notas-entrega/${id}`);
    if (!res.ok) {
      toast("Nota no encontrada", "error");
      router.push("/notas-entrega");
      return;
    }
    const data = await res.json();
    data.items = (data.items || []).sort((a: NotaItem, b: NotaItem) => a.sort_order - b.sort_order);
    setNota(data);
    setLoading(false);
  }, [id, router, toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setRole(localStorage.getItem("brandit_role") || "");
  }, []);

  const isAdmin = role === "admin";

  const startEdit = () => {
    if (!nota) return;
    setEditTipo(nota.tipo === "muestras" ? "muestras" : "pedido");
    setEditCliente(nota.cliente);
    setEditContacto(nota.contacto || "");
    setEditNumero(nota.numero_contacto || "");
    setEditAtencion(nota.atencion || "");
    setEditFecha(nota.fecha);
    setEditItems(
      nota.items.map((i) => ({
        marca: i.marca || "",
        descripcion: i.descripcion,
        color: i.color || "",
        talla: i.talla || "",
        cantidad: i.cantidad,
      }))
    );
    setEditing(true);
  };

  // Duplica la línea en edición: copia marca/descripcion/color, talla vacía y cantidad 1, justo debajo.
  const duplicateEditItem = (idx: number) => {
    setEditItems((prev) => {
      const orig = prev[idx];
      const copy = { marca: orig.marca, descripcion: orig.descripcion, color: orig.color, talla: "", cantidad: 1 };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  };

  const saveEdit = async () => {
    if (!editCliente.trim()) {
      toast("Cliente es requerido", "error");
      return;
    }
    const validItems = editItems.filter((i) => i.descripcion.trim());
    if (validItems.length === 0) {
      toast("Agrega al menos un item", "error");
      return;
    }

    setSavingEdit(true);
    try {
      const res = await fetch(`/api/notas-entrega/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: editTipo,
          cliente: editCliente.trim(),
          contacto: editContacto.trim() || null,
          numero_contacto: editNumero.trim() || null,
          atencion: editAtencion.trim() || null,
          fecha: editFecha,
          items: validItems,
        }),
      });
      if (!res.ok) throw new Error("Error al guardar");
      const updated = await res.json();
      updated.items = (updated.items || []).sort((a: NotaItem, b: NotaItem) => a.sort_order - b.sort_order);
      setNota(updated);
      setEditing(false);
      toast("Nota actualizada");
    } catch {
      toast("Error al guardar", "error");
    }
    setSavingEdit(false);
  };

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/notas-entrega/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      toast("Nota eliminada");
      router.push("/notas-entrega");
    } catch (e) {
      toast((e as Error).message, "error");
    }
    setShowDeleteModal(false);
  };

  const handlePDF = () => {
    if (!nota) return;
    generateNotaPDF(nota);
  };

  const handleAprobar = async () => {
    setAprobando(true);
    try {
      const res = await fetch(`/api/notas-entrega/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "aprobar",
          aprobado_por: localStorage.getItem("brandit_nombre") || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Error al aprobar");
      }
      const updated = await res.json();
      updated.items = (updated.items || []).sort((a: NotaItem, b: NotaItem) => a.sort_order - b.sort_order);
      setNota(updated);
      toast("Nota aprobada");
    } catch (e) {
      toast((e as Error).message, "error");
    }
    setAprobando(false);
  };

  const handleCerrar = async () => {
    if (!scanFile) {
      toast("Selecciona un archivo escaneado", "error");
      return;
    }

    setClosing(true);
    try {
      // Convert file to base64
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(scanFile);
      });

      const res = await fetch(`/api/notas-entrega/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estado: "cerrada",
          scan_url: base64,
        }),
      });
      if (!res.ok) throw new Error("Error al cerrar");
      const updated = await res.json();
      updated.items = (updated.items || []).sort((a: NotaItem, b: NotaItem) => a.sort_order - b.sort_order);
      setNota(updated);
      setShowCerrarModal(false);
      setScanFile(null);
      toast("Nota cerrada");
    } catch {
      toast("Error al cerrar nota", "error");
    }
    setClosing(false);
  };

  if (loading) {
    return <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 text-center text-gray-300 py-24">Cargando...</div>;
  }

  if (!nota) return null;

  const totalCantidad = nota.items.reduce((sum, i) => sum + Number(i.cantidad), 0);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Back */}
      <button
        onClick={() => router.push("/notas-entrega")}
        className="text-sm text-gray-400 hover:text-brandit-orange transition-colors mb-6 flex items-center gap-1"
      >
        &#8592; Notas de Entrega
      </button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xs font-bold text-gray-400 bg-gray-50 rounded-lg px-3 py-1">{nota.numero}</span>
            <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full capitalize ${estadoBadge(nota.estado)}`}>
              {nota.estado}
            </span>
            <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-brandit-orange/10 text-brandit-orange capitalize">
              {nota.tipo === "muestras" ? "Muestras" : "Pedido"}
            </span>
          </div>
          <h1 className="text-3xl font-bold text-brandit-black tracking-tight">{nota.cliente}</h1>
          {(nota.contacto || nota.numero_contacto) && (
            <p className="text-sm text-gray-500 mt-1">
              {nota.contacto && <span>Atn: {nota.contacto}</span>}
              {nota.contacto && nota.numero_contacto && <span className="text-gray-300 mx-2">·</span>}
              {nota.numero_contacto && <span>{nota.numero_contacto}</span>}
            </p>
          )}
          <p className="text-sm text-gray-400 mt-1">{formatFecha(nota.fecha)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {nota.estado === "pendiente" && (
            <>
              {!editing && (
                <button
                  onClick={startEdit}
                  className="px-5 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:border-brandit-orange hover:text-brandit-orange transition-colors min-h-[44px]"
                >
                  Editar
                </button>
              )}
              <button
                onClick={() => setShowDeleteModal(true)}
                className="px-5 py-2.5 rounded-xl text-sm font-medium border border-red-200 text-red-500 hover:bg-red-50 transition-colors min-h-[44px]"
              >
                Eliminar
              </button>
              {isAdmin && (
                <button
                  onClick={handleAprobar}
                  disabled={aprobando}
                  className="bg-green-600 text-white rounded-xl px-6 py-2.5 text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50 min-h-[44px]"
                >
                  {aprobando ? "Aprobando..." : "Aprobar"}
                </button>
              )}
            </>
          )}
          {nota.estado === "abierta" && (
            <>
              {!editing && (
                <button
                  onClick={startEdit}
                  className="px-5 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:border-brandit-orange hover:text-brandit-orange transition-colors min-h-[44px]"
                >
                  Editar
                </button>
              )}
              <button
                onClick={() => setShowDeleteModal(true)}
                className="px-5 py-2.5 rounded-xl text-sm font-medium border border-red-200 text-red-500 hover:bg-red-50 transition-colors min-h-[44px]"
              >
                Eliminar
              </button>
              <button
                onClick={handlePDF}
                className="px-5 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:border-brandit-orange hover:text-brandit-orange transition-colors min-h-[44px]"
              >
                Imprimir PDF
              </button>
              <button
                onClick={() => setShowCerrarModal(true)}
                className="bg-green-600 text-white rounded-xl px-6 py-2.5 text-sm font-medium hover:bg-green-700 transition-colors min-h-[44px]"
              >
                Cerrar nota
              </button>
            </>
          )}
          {nota.estado === "cerrada" && (
            <button
              onClick={handlePDF}
              className="px-5 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:border-brandit-orange hover:text-brandit-orange transition-colors min-h-[44px]"
            >
              Imprimir PDF
            </button>
          )}
        </div>
      </div>

      {/* Aviso pendiente de aprobación (solo muestras) */}
      {nota.estado === "pendiente" && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6 flex items-start gap-3">
          <span className="text-xl">⏳</span>
          <div>
            <p className="text-sm font-bold text-amber-800">Pendiente de aprobación</p>
            <p className="text-xs text-amber-700 mt-0.5">
              {isAdmin
                ? "Aprobá esta nota para poder imprimir el PDF y cerrarla."
                : "Un administrador debe aprobar esta nota antes de imprimir o cerrarla."}
            </p>
          </div>
        </div>
      )}

      {/* Nota al cliente */}
      {nota.atencion && !editing && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-2">Nota al cliente</p>
          <p className="text-sm text-gray-700">{nota.atencion}</p>
        </div>
      )}

      {/* Edit form */}
      {editing && (
        <div className="bg-white rounded-2xl border border-brandit-orange/20 p-6 sm:p-8 mb-6">
          <h2 className="text-lg font-bold text-brandit-black mb-6">Editar Nota</h2>

          {/* Tipo toggle */}
          <div className="mb-6">
            <label className="block text-xs uppercase tracking-widest text-gray-400 mb-2">Tipo de nota *</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditTipo("pedido")}
                className={`flex-1 py-3 rounded-xl text-sm font-medium transition-colors min-h-[44px] ${
                  editTipo === "pedido" ? "bg-brandit-orange text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                Pedido
              </button>
              <button
                type="button"
                onClick={() => setEditTipo("muestras")}
                className={`flex-1 py-3 rounded-xl text-sm font-medium transition-colors min-h-[44px] ${
                  editTipo === "muestras" ? "bg-brandit-orange text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                Muestras
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-xs uppercase tracking-widest text-gray-400 mb-2">Cliente *</label>
              <input
                type="text"
                value={editCliente}
                onChange={(e) => setEditCliente(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brandit-orange transition-colors min-h-[44px]"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-gray-400 mb-2">Fecha</label>
              <input
                type="date"
                value={editFecha}
                onChange={(e) => setEditFecha(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brandit-orange transition-colors min-h-[44px]"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-xs uppercase tracking-widest text-gray-400 mb-2">Atención</label>
              <input
                type="text"
                value={editContacto}
                onChange={(e) => setEditContacto(e.target.value)}
                placeholder="Nombre del contacto"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brandit-orange transition-colors min-h-[44px]"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-gray-400 mb-2">Número</label>
              <input
                type="tel"
                value={editNumero}
                onChange={(e) => setEditNumero(e.target.value)}
                placeholder="Teléfono de contacto"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brandit-orange transition-colors min-h-[44px]"
              />
            </div>
          </div>
          <div className="mb-6">
            <label className="block text-xs uppercase tracking-widest text-gray-400 mb-2">Nota al cliente</label>
            <textarea
              value={editAtencion}
              onChange={(e) => setEditAtencion(e.target.value)}
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brandit-orange transition-colors resize-none"
            />
          </div>

          {/* Edit items */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs uppercase tracking-widest text-gray-400 font-medium">Items</p>
            <button
              onClick={() => setEditItems((prev) => [...prev, { marca: "", descripcion: "", color: "", talla: "", cantidad: 1 }])}
              className="text-sm font-medium text-brandit-orange hover:underline"
            >
              + Agregar
            </button>
          </div>
          <div className="space-y-3">
            {editItems.map((item, idx) => (
              <div key={idx} className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-end">
                <input
                  type="text"
                  placeholder="Marca"
                  value={item.marca}
                  onChange={(e) => {
                    const n = [...editItems];
                    n[idx] = { ...n[idx], marca: e.target.value };
                    setEditItems(n);
                  }}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brandit-orange"
                />
                <input
                  type="text"
                  placeholder="Descripcion *"
                  value={item.descripcion}
                  onChange={(e) => {
                    const n = [...editItems];
                    n[idx] = { ...n[idx], descripcion: e.target.value };
                    setEditItems(n);
                  }}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brandit-orange sm:col-span-2"
                />
                <input
                  type="text"
                  placeholder="Color"
                  value={item.color}
                  onChange={(e) => {
                    const n = [...editItems];
                    n[idx] = { ...n[idx], color: e.target.value };
                    setEditItems(n);
                  }}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brandit-orange"
                />
                <input
                  type="text"
                  placeholder="Talla"
                  value={item.talla}
                  onChange={(e) => {
                    const n = [...editItems];
                    n[idx] = { ...n[idx], talla: e.target.value };
                    setEditItems(n);
                  }}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brandit-orange"
                />
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={1}
                    value={item.cantidad}
                    onChange={(e) => {
                      const n = [...editItems];
                      n[idx] = { ...n[idx], cantidad: Number(e.target.value) };
                      setEditItems(n);
                    }}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brandit-orange text-center"
                  />
                  <button
                    onClick={() => duplicateEditItem(idx)}
                    title="Duplicar"
                    className="text-gray-300 hover:text-brandit-orange transition-colors p-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                  {editItems.length > 1 && (
                    <button
                      onClick={() => setEditItems((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-gray-300 hover:text-red-500 transition-colors p-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-gray-100">
            <button
              onClick={() => setEditing(false)}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors min-h-[44px]"
            >
              Cancelar
            </button>
            <button
              onClick={saveEdit}
              disabled={savingEdit}
              className="bg-brandit-orange text-white rounded-xl px-6 py-2.5 text-sm font-medium hover:bg-brandit-orange/90 transition-colors disabled:opacity-50 min-h-[44px]"
            >
              {savingEdit ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </div>
      )}

      {/* Items table */}
      {!editing && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-6">
          {/* Desktop */}
          <div className="hidden sm:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-6 py-3 text-[10px] uppercase tracking-widest text-gray-400 font-medium">Marca</th>
                  <th className="text-left px-6 py-3 text-[10px] uppercase tracking-widest text-gray-400 font-medium">Descripcion</th>
                  <th className="text-left px-6 py-3 text-[10px] uppercase tracking-widest text-gray-400 font-medium">Color</th>
                  <th className="text-left px-6 py-3 text-[10px] uppercase tracking-widest text-gray-400 font-medium">Talla</th>
                  <th className="text-center px-6 py-3 text-[10px] uppercase tracking-widest text-gray-400 font-medium">Cantidad</th>
                </tr>
              </thead>
              <tbody>
                {nota.items.map((item, idx) => (
                  <tr key={idx} className="border-b border-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-600">{item.marca || "-"}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.descripcion}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{item.color || "-"}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{item.talla || "-"}</td>
                    <td className="px-6 py-4 text-sm font-bold text-center text-brandit-black">{item.cantidad}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50/50">
                  <td colSpan={4} className="px-6 py-3 text-sm font-bold text-right text-gray-500">TOTAL</td>
                  <td className="px-6 py-3 text-sm font-bold text-center text-brandit-black">{totalCantidad}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Mobile */}
          <div className="sm:hidden divide-y divide-gray-50">
            {nota.items.map((item, idx) => (
              <div key={idx} className="px-5 py-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-gray-900">{item.descripcion}</p>
                  <span className="text-sm font-bold text-brandit-black">{item.cantidad}</span>
                </div>
                <p className="text-xs text-gray-400">
                  {[item.marca, item.color, item.talla].filter(Boolean).join(" - ") || "Sin detalles"}
                </p>
              </div>
            ))}
            <div className="px-5 py-3 bg-gray-50/50 flex items-center justify-between">
              <span className="text-sm font-bold text-gray-500">TOTAL</span>
              <span className="text-sm font-bold text-brandit-black">{totalCantidad}</span>
            </div>
          </div>
        </div>
      )}

      {/* Scan image for cerrada notas */}
      {nota.estado === "cerrada" && nota.scan_url && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-4">Documento escaneado</p>
          {nota.scan_url.startsWith("data:image") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={nota.scan_url} alt="Scan" className="max-w-full rounded-xl border border-gray-100" />
          ) : nota.scan_url.startsWith("data:application/pdf") ? (
            <p className="text-sm text-gray-500">PDF escaneado guardado</p>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={nota.scan_url} alt="Scan" className="max-w-full rounded-xl border border-gray-100" />
          )}
        </div>
      )}

      {/* Metadata */}
      <div className="text-xs text-gray-300 text-center mt-8">
        Creada por {nota.created_by || "Sistema"} el {new Date(nota.created_at).toLocaleString("es-PA")}
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <>
          <div className="fixed inset-0 bg-black/60 z-[80]" onClick={() => setShowDeleteModal(false)} />
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-fade-in-up">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Eliminar nota</h3>
              <p className="text-sm text-gray-500 mb-6">Esta accion no se puede deshacer. Se eliminara la nota {nota.numero} y todos sus items.</p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors min-h-[44px]"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  className="px-5 py-2.5 rounded-xl text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors min-h-[44px]"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Cerrar modal - upload scan */}
      {showCerrarModal && (
        <>
          <div className="fixed inset-0 bg-black/60 z-[80]" onClick={() => setShowCerrarModal(false)} />
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-fade-in-up">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Cerrar nota</h3>
              <p className="text-sm text-gray-500 mb-4">Sube el scan de la nota firmada por el cliente.</p>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => setScanFile(e.target.files?.[0] || null)}
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-brandit-orange/10 file:text-brandit-orange hover:file:bg-brandit-orange/20 mb-6"
              />
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => { setShowCerrarModal(false); setScanFile(null); }}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors min-h-[44px]"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCerrar}
                  disabled={!scanFile || closing}
                  className="px-5 py-2.5 rounded-xl text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50 min-h-[44px]"
                >
                  {closing ? "Cerrando..." : "Cerrar nota"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
