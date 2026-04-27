"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import StickerForm, { StickerFormValues } from "@/components/StickerForm";

type Sticker = StickerFormValues & {
  id: string;
  created_at: string;
};

export default function EditarStickerPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [role, setRole] = useState<string | null>(null);
  const [sticker, setSticker] = useState<Sticker | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        if (data.error) {
          setError(data.error);
        } else {
          setSticker(data);
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Error");
        setLoading(false);
      });
  }, [id, role]);

  if (role === null) return null;
  if (role !== "admin" && role !== "secretaria") return null;

  return (
    <div className="min-h-screen" style={{ background: "#fafaf7" }}>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <Link
            href={`/stickers/${id}`}
            className="text-xs font-mono uppercase tracking-widest text-gray-400 hover:text-brandit-orange transition-colors"
          >
            ← Detalle
          </Link>
          <h1 className="text-3xl font-bold text-brandit-black tracking-tight font-outfit mt-2">
            Editar Sticker
          </h1>
        </div>

        <div className="bg-white border border-[#eeebe6] p-6" style={{ borderRadius: "14px" }}>
          {loading ? (
            <p className="text-gray-300 text-sm">Cargando...</p>
          ) : error || !sticker ? (
            <p className="text-red-600 text-sm">{error || "No se encontró el sticker"}</p>
          ) : (
            <StickerForm
              mode="edit"
              stickerId={id}
              initial={{
                descripcion: sticker.descripcion,
                talla: sticker.talla,
                color_nombre: sticker.color_nombre,
                color_hex: sticker.color_hex,
                seccion: sticker.seccion,
                estante: sticker.estante,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
