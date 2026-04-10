"use client";

import { useRef, useEffect, useState } from "react";

type Props = {
  onSave: (base64: string) => void;
  onCancel: () => void;
};

export default function SignatureCanvas({ onSave, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const pointsRef = useRef<{ x: number; y: number }[]>([]);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    function getPos(e: MouseEvent | TouchEvent): { x: number; y: number } {
      const rect = canvas!.getBoundingClientRect();
      const scaleX = canvas!.width / rect.width;
      const scaleY = canvas!.height / rect.height;
      if ("touches" in e) {
        return {
          x: (e.touches[0].clientX - rect.left) * scaleX,
          y: (e.touches[0].clientY - rect.top) * scaleY,
        };
      }
      return {
        x: ((e as MouseEvent).clientX - rect.left) * scaleX,
        y: ((e as MouseEvent).clientY - rect.top) * scaleY,
      };
    }

    function startDraw(e: MouseEvent | TouchEvent) {
      e.preventDefault();
      isDrawingRef.current = true;
      const pos = getPos(e);
      pointsRef.current = [pos];
      setHasDrawn(true);
    }

    function draw(e: MouseEvent | TouchEvent) {
      if (!isDrawingRef.current) return;
      e.preventDefault();

      const pos = getPos(e);
      const points = pointsRef.current;
      points.push(pos);

      const ctx = canvas!.getContext("2d")!;

      if (points.length < 3) {
        // Just draw a dot for the first point
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 1.5, 0, Math.PI * 2);
        ctx.fill();
        return;
      }

      // Draw smooth continuous line using quadratic bezier through midpoints
      // This produces a smooth, connected curve — not individual dots
      ctx.beginPath();

      const p0 = points[points.length - 3];
      const p1 = points[points.length - 2];
      const p2 = points[points.length - 1];

      // Move to midpoint between p0 and p1
      const mid1x = (p0.x + p1.x) / 2;
      const mid1y = (p0.y + p1.y) / 2;
      // Draw curve from mid(p0,p1) through p1 to mid(p1,p2)
      const mid2x = (p1.x + p2.x) / 2;
      const mid2y = (p1.y + p2.y) / 2;

      ctx.moveTo(mid1x, mid1y);
      ctx.quadraticCurveTo(p1.x, p1.y, mid2x, mid2y);
      ctx.stroke();
    }

    function stopDraw() {
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;

      // Draw final segment to last point
      const points = pointsRef.current;
      if (points.length >= 2) {
        const ctx = canvas!.getContext("2d")!;
        const p1 = points[points.length - 2];
        const p2 = points[points.length - 1];
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        ctx.beginPath();
        ctx.moveTo(midX, midY);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
      pointsRef.current = [];
    }

    canvas.addEventListener("mousedown", startDraw);
    canvas.addEventListener("mousemove", draw);
    canvas.addEventListener("mouseup", stopDraw);
    canvas.addEventListener("mouseleave", stopDraw);
    canvas.addEventListener("touchstart", startDraw, { passive: false });
    canvas.addEventListener("touchmove", draw, { passive: false });
    canvas.addEventListener("touchend", stopDraw);

    return () => {
      canvas.removeEventListener("mousedown", startDraw);
      canvas.removeEventListener("mousemove", draw);
      canvas.removeEventListener("mouseup", stopDraw);
      canvas.removeEventListener("mouseleave", stopDraw);
      canvas.removeEventListener("touchstart", startDraw);
      canvas.removeEventListener("touchmove", draw);
      canvas.removeEventListener("touchend", stopDraw);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const save = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const base64 = canvas.toDataURL("image/jpeg", 0.95);
    onSave(base64);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[80] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in-up">
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-brandit-black">Dibuja tu firma</h2>
          <p className="text-xs text-gray-400 mt-1">Solo necesitas hacer esto una vez</p>
        </div>
        <div className="p-6">
          <canvas
            ref={canvasRef}
            className="w-full h-48 border border-gray-200 rounded-xl cursor-crosshair touch-none"
            style={{ backgroundColor: "#FFFFFF" }}
          />
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors min-h-[44px]"
            >
              Cancelar
            </button>
            <button
              onClick={clear}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors min-h-[44px]"
            >
              Limpiar
            </button>
          </div>
          <button
            onClick={save}
            disabled={!hasDrawn}
            className="bg-brandit-orange text-white rounded-xl px-6 py-2.5 text-sm font-medium hover:bg-brandit-orange/90 transition-colors disabled:opacity-40 min-h-[44px]"
          >
            Guardar firma
          </button>
        </div>
      </div>
    </div>
  );
}
