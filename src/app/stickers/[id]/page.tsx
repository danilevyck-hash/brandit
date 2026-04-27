"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import StickerCard from "@/components/StickerCard";

type Sticker = {
  id: string;
  descripcion: string;
  talla: string;
  color_nombre: string;
  color_hex: string;
  seccion: string;
  estante: string;
  created_at: string;
  updated_at: string;
};

export default function StickerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [role, setRole] = useState<string | null>(null);
  const [sticker, setSticker] = useState<Sticker | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const r = localStorage.getItem("brandit_role") || "";
    setRole(r);
    if (r !== "admin" && r !== "secretaria") {
      router.replace("/");
    }
  }, [router]);

  useEffect(() => {
    if (role !== "admin" && role !== "secretaria") return;
    fetch(`/api/stickers/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setSticker(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Error");
        setLoading(false);
      });
  }, [id, role]);

  const handleDelete = async () => {
    if (!confirm("¿Eliminar este sticker? Esta acción no se puede deshacer.")) return;
    setDeleting(true);
    const res = await fetch(`/api/stickers/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.error) {
      alert(data.error);
      setDeleting(false);
      return;
    }
    router.push("/stickers");
  };

  const handlePrint = () => {
    window.print();
  };

  const fmtDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString("es-PA", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  if (role === null) return null;
  if (role !== "admin" && role !== "secretaria") return null;

  return (
    <div className="min-h-screen" style={{ background: "#fafaf7" }}>
      <style jsx global>{`
        @media print {
          body { background: white !important; }
          nav, .sticker-page-chrome { display: none !important; }
          .sticker-print-area { padding: 0 !important; margin: 0 !important; }
          .sticker-print-area .sticker-card {
            margin: 0 !important;
            border: none !important;
          }
          @page { size: 10cm 5.5cm; margin: 0; }
        }
      `}</style>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="sticker-page-chrome mb-6">
          <Link
            href="/stickers"
            className="text-xs font-mono uppercase tracking-widest text-gray-400 hover:text-brandit-orange transition-colors"
          >
            ← Stickers
          </Link>
          <h1 className="text-3xl font-bold text-brandit-black tracking-tight font-outfit mt-2">
            Detalle del Sticker
          </h1>
        </div>

        {loading ? (
          <p className="text-gray-300 text-sm sticker-page-chrome">Cargando...</p>
        ) : error || !sticker ? (
          <p className="text-red-600 text-sm sticker-page-chrome">{error || "No se encontró el sticker"}</p>
        ) : (
          <>
            {/* Sticker preview - centered */}
            <div className="sticker-print-area flex justify-center mb-8">
              <StickerCard
                id={sticker.id}
                descripcion={sticker.descripcion}
                talla={sticker.talla}
                colorNombre={sticker.color_nombre}
                colorHex={sticker.color_hex}
                seccion={sticker.seccion}
                estante={sticker.estante}
                createdAt={sticker.created_at}
                size="preview"
              />
            </div>

            {/* Action buttons */}
            <div className="sticker-page-chrome flex flex-wrap gap-3 justify-center mb-8">
              <Link
                href={`/stickers/${sticker.id}/editar`}
                className="bg-brandit-orange text-white rounded-xl px-6 py-2.5 text-sm font-semibold hover:bg-brandit-orange/90 transition-colors font-outfit"
              >
                Editar
              </Link>
              <button
                onClick={handlePrint}
                className="bg-[#111] text-white rounded-xl px-6 py-2.5 text-sm font-semibold hover:bg-black transition-colors font-outfit"
              >
                Imprimir
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="bg-white border border-red-200 text-red-600 rounded-xl px-6 py-2.5 text-sm font-semibold hover:bg-red-50 transition-colors disabled:opacity-50 font-outfit"
              >
                {deleting ? "Eliminando..." : "Eliminar"}
              </button>
            </div>

            {/* Details table */}
            <div className="sticker-page-chrome bg-white border border-[#eeebe6] overflow-hidden" style={{ borderRadius: "14px" }}>
              <table className="w-full text-sm">
                <tbody>
                  <Row label="ID" value={sticker.id} mono />
                  <Row label="Descripción" value={sticker.descripcion} />
                  <Row label="Talla" value={sticker.talla} />
                  <Row
                    label="Color"
                    value={
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block w-4 h-4 rounded-full border border-black/10"
                          style={{ background: sticker.color_hex }}
                        />
                        {sticker.color_nombre}
                        <span className="text-gray-400 font-mono text-[11px]">{sticker.color_hex}</span>
                      </span>
                    }
                  />
                  <Row label="Sección" value={sticker.seccion} />
                  <Row label="Estante" value={sticker.estante} />
                  <Row label="Creado" value={fmtDate(sticker.created_at)} />
                  {sticker.updated_at && sticker.updated_at !== sticker.created_at && (
                    <Row label="Actualizado" value={fmtDate(sticker.updated_at)} />
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <tr className="border-b border-[#f5f3ee] last:border-0">
      <td className="py-3 px-4 text-xs font-mono uppercase tracking-widest text-gray-400 align-top w-1/3">
        {label}
      </td>
      <td className={`py-3 px-4 text-brandit-black ${mono ? "font-mono text-xs" : "font-outfit"}`}>
        {value}
      </td>
    </tr>
  );
}
