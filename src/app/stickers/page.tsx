"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Sticker = {
  id: string;
  descripcion: string;
  talla: string;
  color_nombre: string;
  color_hex: string;
  seccion: string;
  estante: string;
  created_at: string;
};

export default function StickersListPage() {
  const router = useRouter();
  const [role, setRole] = useState("");
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const r = localStorage.getItem("brandit_role") || "";
    setRole(r);
    if (r !== "admin" && r !== "secretaria") {
      router.replace("/");
    }
  }, [router]);

  useEffect(() => {
    if (role !== "admin" && role !== "secretaria") return;
    setLoading(true);
    fetch("/api/stickers")
      .then((r) => r.json())
      .then((data) => {
        setStickers(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [role]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stickers;
    return stickers.filter((s) => {
      const blob = `${s.descripcion} ${s.talla} ${s.color_nombre} ${s.seccion} ${s.estante}`.toLowerCase();
      return blob.includes(q);
    });
  }, [stickers, query]);

  if (role !== "admin" && role !== "secretaria") {
    return null;
  }

  return (
    <div className="min-h-screen" style={{ background: "#fafaf7" }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-gray-400 mb-1 font-mono">Bodega</p>
            <h1 className="text-3xl font-bold text-brandit-black tracking-tight font-outfit">
              Stickers de Bodega
            </h1>
            <p className="text-sm text-gray-400 mt-1">Etiquetas con QR para identificar productos en bodega</p>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Buscar por descripción, talla, color, ubicación..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-white border border-[#eeebe6] rounded-2xl px-5 py-3 text-sm outline-none focus:border-brandit-orange transition-colors font-outfit"
            style={{ borderRadius: "14px" }}
          />
        </div>

        {/* Grid */}
        {loading ? (
          <p className="text-center text-gray-300 py-24">Cargando...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-2xl border border-[#eeebe6]" style={{ borderRadius: "14px" }}>
            <p className="text-gray-400 text-lg mb-1">
              {stickers.length === 0 ? "No hay stickers." : "Sin resultados."}
            </p>
            <p className="text-gray-300 text-sm">
              {stickers.length === 0 ? "Crea el primero." : "Prueba otra búsqueda."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {filtered.map((s) => (
              <Link
                key={s.id}
                href={`/stickers/${s.id}`}
                className="bg-white border border-[#eeebe6] p-4 hover:border-brandit-orange/40 hover:shadow-md transition-all"
                style={{ borderRadius: "14px" }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="inline-block w-4 h-4 rounded-full border border-black/10 flex-shrink-0"
                    style={{ background: s.color_hex }}
                  />
                  <p className="text-[11px] font-mono uppercase tracking-widest text-gray-400 truncate">
                    {s.seccion} · {s.estante}
                  </p>
                </div>
                <p className="text-sm font-semibold text-brandit-black font-outfit truncate" title={s.descripcion}>
                  {s.descripcion}
                </p>
                <p className="text-xs text-gray-400 mt-1 truncate">
                  {s.talla} · {s.color_nombre}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <Link
        href="/stickers/nuevo"
        className="fixed bottom-6 right-6 bg-brandit-orange text-white rounded-full w-14 h-14 flex items-center justify-center text-3xl shadow-lg hover:scale-110 transition-transform"
        aria-label="Crear sticker"
      >
        +
      </Link>
    </div>
  );
}
