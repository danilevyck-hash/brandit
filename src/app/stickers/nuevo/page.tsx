"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import StickerForm from "@/components/StickerForm";

export default function NuevoStickerPage() {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const r = localStorage.getItem("brandit_role") || "";
    setRole(r);
    if (r !== "admin" && r !== "secretaria") {
      router.replace("/");
    }
  }, [router]);

  if (role === null) return null;
  if (role !== "admin" && role !== "secretaria") return null;

  return (
    <div className="min-h-screen" style={{ background: "#fafaf7" }}>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <Link
            href="/stickers"
            className="text-xs font-mono uppercase tracking-widest text-gray-400 hover:text-brandit-orange transition-colors"
          >
            ← Stickers
          </Link>
          <h1 className="text-3xl font-bold text-brandit-black tracking-tight font-outfit mt-2">
            Nuevo Sticker
          </h1>
          <p className="text-sm text-gray-400 mt-1">Llena los datos para generar la etiqueta</p>
        </div>

        <div className="bg-white border border-[#eeebe6] p-6" style={{ borderRadius: "14px" }}>
          <StickerForm mode="create" />
        </div>
      </div>
    </div>
  );
}
