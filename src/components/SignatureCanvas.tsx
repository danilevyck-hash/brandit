"use client";

import { useRef, useEffect, useState, useCallback } from "react";

type Props = {
  onSave: (base64: string) => void;
  onCancel: () => void;
};

export default function SignatureCanvas({ onSave, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  const getPos = useCallback((e: MouseEvent | TouchEvent): { x: number; y: number } => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ("touches" in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  const startDraw = useCallback((e: MouseEvent | TouchEvent) => {
    e.preventDefault();
    setIsDrawing(true);
    setHasDrawn(true);
    lastPoint.current = getPos(e);
  }, [getPos]);

  const draw = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDrawing || !lastPoint.current) return;
    e.preventDefault();

    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const pos = getPos(e);

    // Smooth bezier curve
    const midX = (lastPoint.current.x + pos.x) / 2;
    const midY = (lastPoint.current.y + pos.y) / 2;

    ctx.beginPath();
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
    ctx.quadraticCurveTo(lastPoint.current.x, lastPoint.current.y, midX, midY);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();

    lastPoint.current = pos;
  }, [isDrawing, getPos]);

  const stopDraw = useCallback(() => {
    setIsDrawing(false);
    lastPoint.current = null;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;

    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Event listeners
    const mouseDown = (e: MouseEvent) => startDraw(e);
    const mouseMove = (e: MouseEvent) => draw(e);
    const mouseUp = () => stopDraw();
    const touchStart = (e: TouchEvent) => startDraw(e);
    const touchMove = (e: TouchEvent) => draw(e);
    const touchEnd = () => stopDraw();

    canvas.addEventListener("mousedown", mouseDown);
    canvas.addEventListener("mousemove", mouseMove);
    canvas.addEventListener("mouseup", mouseUp);
    canvas.addEventListener("mouseleave", mouseUp);
    canvas.addEventListener("touchstart", touchStart, { passive: false });
    canvas.addEventListener("touchmove", touchMove, { passive: false });
    canvas.addEventListener("touchend", touchEnd);

    return () => {
      canvas.removeEventListener("mousedown", mouseDown);
      canvas.removeEventListener("mousemove", mouseMove);
      canvas.removeEventListener("mouseup", mouseUp);
      canvas.removeEventListener("mouseleave", mouseUp);
      canvas.removeEventListener("touchstart", touchStart);
      canvas.removeEventListener("touchmove", touchMove);
      canvas.removeEventListener("touchend", touchEnd);
    };
  }, [startDraw, draw, stopDraw]);

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
    const base64 = canvas.toDataURL("image/png");
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
