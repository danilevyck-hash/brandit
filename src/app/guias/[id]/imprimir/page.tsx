"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useGuiaAuth } from "../../hooks/useGuiaAuth";
import GuiaDetail from "../../components/GuiaDetail";
import type { Guia } from "../../components/types";

export default function GuiaImprimirPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? null;
  const { authChecked } = useGuiaAuth();

  const [guia, setGuia] = useState<Guia | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const printedRef = useRef(false);

  useEffect(() => {
    if (!authChecked || !id) return;
    let cancelado = false;
    (async () => {
      try {
        const res = await fetch(`/api/guias/${id}`);
        if (!res.ok) {
          if (!cancelado) setError("Guía no encontrada");
          return;
        }
        const data = (await res.json()) as Guia;
        if (!cancelado) setGuia(data);
      } catch {
        if (!cancelado) setError("Error al cargar guía");
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => { cancelado = true; };
  }, [authChecked, id]);

  // Auto-lanza el diálogo de impresión una sola vez, cuando la guía ya cargó
  // y el PrintDocument está renderizado. El botón manual queda como respaldo.
  useEffect(() => {
    if (loading || !guia || printedRef.current) return;
    printedRef.current = true;
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, [loading, guia]);

  if (!authChecked) return null;

  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <div className="h-48 bg-gray-100 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !guia) {
    return (
      <div className="min-h-screen">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 text-center">
          <p className="text-sm text-red-500">{error || "No encontrada"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <GuiaDetail guia={guia} onBack={() => router.push("/guias")} />
    </div>
  );
}
