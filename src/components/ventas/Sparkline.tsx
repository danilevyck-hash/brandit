"use client";

type Props = {
  /** 12 valores; null se trata como 0. */
  data: (number | null)[];
  width?: number;
  height?: number;
};

/**
 * Mini line chart SVG decorativo, sin ejes/labels. 12 puntos equiespaciados
 * horizontalmente, escala Y automática (min/max de data + 10% padding).
 * Color del trazo via stroke-current sobre text-teal-600.
 */
export default function Sparkline({ data, width = 240, height = 60 }: Props) {
  const padded = data.length === 12 ? data : [...data, ...Array(Math.max(0, 12 - data.length)).fill(0)].slice(0, 12);
  const values = padded.map((v) => v ?? 0);

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const yPad = range * 0.1;
  const yMin = min - yPad;
  const yMax = max + yPad;
  const yRange = yMax - yMin || 1;

  // 12 puntos → 11 segmentos. x del punto i = (i / 11) * width.
  const points = values
    .map((v, i) => {
      const x = (i / 11) * width;
      const y = height - ((v - yMin) / yRange) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="text-teal-600"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
