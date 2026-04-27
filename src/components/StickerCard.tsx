"use client";

import { QRCodeSVG } from "qrcode.react";

type Props = {
  id: string;
  descripcion: string;
  talla: string;
  colorNombre: string;
  colorHex: string;
  seccion: string;
  estante: string;
  createdAt: string;
  size?: "preview" | "print";
};

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("es-PA", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

export default function StickerCard({
  id,
  descripcion,
  talla,
  colorNombre,
  colorHex,
  seccion,
  estante,
  createdAt,
  size = "preview",
}: Props) {
  const ubicacion = `${seccion} · ${estante}`;
  const shortId = id ? id.slice(0, 8) : "--------";
  const qrValue = `${descripcion}|${talla}|${colorNombre}|${seccion}-${estante}|${id}`;

  const isPrint = size === "print";

  const containerStyle: React.CSSProperties = isPrint
    ? { width: "10cm", height: "5.5cm" }
    : { width: "378px", height: "208px" };

  return (
    <div
      className="sticker-card bg-white text-black border border-[#e6e3de] rounded-lg overflow-hidden flex flex-col font-outfit"
      style={containerStyle}
    >
      {/* Top bar */}
      <div className="bg-[#111] text-white h-8 flex items-center justify-between px-3 flex-shrink-0">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] font-bold">BODEGA</span>
        <span className="font-mono text-[11px] uppercase tracking-[0.15em]">{ubicacion}</span>
      </div>

      {/* Body */}
      <div className="flex-1 flex min-h-0">
        {/* Left content */}
        <div className="flex-1 px-3 py-2 flex flex-col justify-between min-w-0">
          <p
            className="font-outfit text-[13px] leading-tight font-semibold text-[#111] uppercase"
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {descripcion}
          </p>

          <div className="flex items-center gap-3 mt-1">
            <span className="font-outfit font-black text-[20px] leading-none text-[#111]">{talla}</span>
            <span className="text-[#ddd]">|</span>
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="inline-block w-3.5 h-3.5 rounded-full border border-black/10 flex-shrink-0"
                style={{ background: colorHex }}
              />
              <span className="text-[11px] text-[#444] truncate">{colorNombre}</span>
            </div>
          </div>
        </div>

        {/* QR column */}
        <div className="w-[80px] bg-[#f5f5f0] border-l border-[#e6e3de] flex items-center justify-center flex-shrink-0">
          <QRCodeSVG value={qrValue} size={64} level="M" />
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-[#eeebe6] px-3 py-1 flex-shrink-0">
        <p className="font-mono text-[8px] text-[#bbb] uppercase tracking-wider">
          ID: {shortId} · {formatDate(createdAt)}
        </p>
      </div>
    </div>
  );
}
