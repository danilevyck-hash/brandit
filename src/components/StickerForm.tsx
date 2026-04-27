"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type StickerFormValues = {
  descripcion: string;
  talla: string;
  color_nombre: string;
  color_hex: string;
  seccion: string;
  estante: string;
};

type Props = {
  initial?: StickerFormValues;
  mode: "create" | "edit";
  stickerId?: string;
};

const TALLAS = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "ÚNICA"];

const COLORES = [
  { nombre: "Negro", hex: "#111111" },
  { nombre: "Blanco", hex: "#ffffff" },
  { nombre: "Gris", hex: "#9ca3af" },
  { nombre: "Azul Marino", hex: "#1e3a5f" },
  { nombre: "Azul Cielo", hex: "#7dd3fc" },
  { nombre: "Verde", hex: "#16a34a" },
  { nombre: "Rojo", hex: "#dc2626" },
  { nombre: "Naranja", hex: "#f15a29" },
  { nombre: "Dorado", hex: "#d97706" },
  { nombre: "Beige", hex: "#d4b896" },
  { nombre: "Rosa", hex: "#f9a8d4" },
  { nombre: "Morado", hex: "#7c3aed" },
];

export default function StickerForm({ initial, mode, stickerId }: Props) {
  const router = useRouter();
  const [descripcion, setDescripcion] = useState(initial?.descripcion || "");
  const [talla, setTalla] = useState(initial?.talla || "");
  const [tallaCustom, setTallaCustom] = useState(
    initial && !TALLAS.includes(initial.talla) ? initial.talla : ""
  );
  const [colorNombre, setColorNombre] = useState(initial?.color_nombre || "");
  const [colorHex, setColorHex] = useState(initial?.color_hex || "");
  const [colorCustomNombre, setColorCustomNombre] = useState(
    initial && !COLORES.some((c) => c.hex === initial.color_hex) ? initial.color_nombre : ""
  );
  const [colorCustomHex, setColorCustomHex] = useState(
    initial && !COLORES.some((c) => c.hex === initial.color_hex) ? initial.color_hex : "#000000"
  );
  const [seccion, setSeccion] = useState(initial?.seccion || "");
  const [estante, setEstante] = useState(initial?.estante || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tallaActiva = tallaCustom ? tallaCustom : talla;

  const isCustomColorActive =
    !!colorCustomNombre &&
    !COLORES.some((c) => c.hex === colorHex && c.nombre === colorNombre);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const finalTalla = tallaCustom.trim() || talla;
    const finalColorNombre = isCustomColorActive ? colorCustomNombre.trim() : colorNombre;
    const finalColorHex = isCustomColorActive ? colorCustomHex : colorHex;

    if (!descripcion.trim()) return setError("Descripción es requerida");
    if (!finalTalla) return setError("Selecciona una talla");
    if (!finalColorNombre || !finalColorHex) return setError("Selecciona un color");
    if (!seccion.trim() || !estante.trim()) return setError("Sección y estante son requeridos");

    setSaving(true);
    try {
      const url = mode === "create" ? "/api/stickers" : `/api/stickers/${stickerId}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descripcion: descripcion.trim(),
          talla: finalTalla,
          color_nombre: finalColorNombre,
          color_hex: finalColorHex,
          seccion: seccion.trim(),
          estante: estante.trim(),
        }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setSaving(false);
        return;
      }
      const targetId = data.id || stickerId;
      router.push(`/stickers/${targetId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      setSaving(false);
    }
  };

  const pickPreset = (nombre: string, hex: string) => {
    setColorNombre(nombre);
    setColorHex(hex);
    setColorCustomNombre("");
  };

  const pickTalla = (t: string) => {
    setTalla(t);
    setTallaCustom("");
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      {/* Descripción */}
      <div>
        <label className="block text-xs font-mono uppercase tracking-widest text-gray-500 mb-2">
          Descripción
        </label>
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Ej: SERVILLETA DE TELA LINO"
          rows={2}
          className="w-full bg-white border border-[#eeebe6] rounded-xl px-4 py-3 text-sm outline-none focus:border-brandit-orange transition-colors font-outfit resize-none"
        />
      </div>

      {/* Talla */}
      <div>
        <label className="block text-xs font-mono uppercase tracking-widest text-gray-500 mb-2">
          Talla
        </label>
        <div className="flex flex-wrap gap-2 mb-3">
          {TALLAS.map((t) => {
            const active = !tallaCustom && talla === t;
            return (
              <button
                type="button"
                key={t}
                onClick={() => pickTalla(t)}
                className={`px-3 py-1.5 rounded-lg text-sm font-outfit font-semibold transition-colors ${
                  active
                    ? "bg-[#111] text-white"
                    : "bg-white border border-[#eeebe6] text-gray-600 hover:border-gray-300"
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
        <input
          type="text"
          value={tallaCustom}
          onChange={(e) => {
            setTallaCustom(e.target.value);
            if (e.target.value) setTalla("");
          }}
          placeholder="Talla custom (opcional)"
          className="w-full bg-white border border-[#eeebe6] rounded-xl px-4 py-2 text-sm outline-none focus:border-brandit-orange transition-colors font-outfit"
        />
      </div>

      {/* Color */}
      <div>
        <label className="block text-xs font-mono uppercase tracking-widest text-gray-500 mb-2">
          Color
        </label>
        <div className="flex flex-wrap gap-3 mb-4">
          {COLORES.map((c) => {
            const active = !isCustomColorActive && colorHex === c.hex && colorNombre === c.nombre;
            return (
              <button
                type="button"
                key={c.nombre}
                onClick={() => pickPreset(c.nombre, c.hex)}
                title={c.nombre}
                className="rounded-full transition-all"
                style={{
                  outline: active ? "2px solid #111" : "none",
                  outlineOffset: active ? "2px" : "0",
                }}
              >
                <span
                  className="block w-9 h-9 rounded-full border border-black/10"
                  style={{ background: c.hex }}
                />
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-widest text-gray-400 mb-1">
              Nombre custom
            </label>
            <input
              type="text"
              value={colorCustomNombre}
              onChange={(e) => {
                setColorCustomNombre(e.target.value);
                if (e.target.value) {
                  setColorNombre(e.target.value);
                  setColorHex(colorCustomHex);
                }
              }}
              placeholder="Ej: Verde Pasto"
              className="w-full bg-white border border-[#eeebe6] rounded-xl px-4 py-2 text-sm outline-none focus:border-brandit-orange transition-colors font-outfit"
            />
          </div>
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-widest text-gray-400 mb-1">
              Hex
            </label>
            <input
              type="color"
              value={colorCustomHex}
              onChange={(e) => {
                setColorCustomHex(e.target.value);
                if (colorCustomNombre) setColorHex(e.target.value);
              }}
              className="w-12 h-10 rounded-xl border border-[#eeebe6] cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Ubicación */}
      <div>
        <label className="block text-xs font-mono uppercase tracking-widest text-gray-500 mb-2">
          Ubicación
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-widest text-gray-400 mb-1">
              Sección
            </label>
            <input
              type="text"
              value={seccion}
              onChange={(e) => setSeccion(e.target.value)}
              placeholder="Ej: A1"
              className="w-full bg-white border border-[#eeebe6] rounded-xl px-4 py-2 text-sm outline-none focus:border-brandit-orange transition-colors font-outfit"
            />
          </div>
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-widest text-gray-400 mb-1">
              Estante
            </label>
            <input
              type="text"
              value={estante}
              onChange={(e) => setEstante(e.target.value)}
              placeholder="Ej: E3"
              className="w-full bg-white border border-[#eeebe6] rounded-xl px-4 py-2 text-sm outline-none focus:border-brandit-orange transition-colors font-outfit"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl px-4 py-2 text-sm">
          {error}
        </div>
      )}

      {/* Preview */}
      {(tallaActiva || colorNombre || descripcion) && (
        <div>
          <label className="block text-xs font-mono uppercase tracking-widest text-gray-500 mb-2">
            Preview
          </label>
          <div className="text-xs text-gray-500 font-outfit">
            <span className="font-semibold">{descripcion || "Descripción"}</span> ·{" "}
            <span>{tallaActiva || "—"}</span> ·{" "}
            <span style={{ color: isCustomColorActive ? colorCustomHex : colorHex }}>
              ●
            </span>{" "}
            <span>{isCustomColorActive ? colorCustomNombre : colorNombre || "—"}</span> ·{" "}
            <span>
              {seccion || "—"} - {estante || "—"}
            </span>
          </div>
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="bg-brandit-orange text-white rounded-xl px-6 py-2.5 text-sm font-semibold hover:bg-brandit-orange/90 transition-colors disabled:opacity-50 font-outfit"
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="bg-white border border-[#eeebe6] text-gray-600 rounded-xl px-6 py-2.5 text-sm font-medium hover:border-gray-300 transition-colors font-outfit"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
