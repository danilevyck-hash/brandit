const COLORS = ["#F15A29", "#22c55e", "#3b82f6", "#a855f7", "#f59e0b", "#06b6d4"];

const SIZES = {
  sm: "w-6 h-6 text-xs",
  md: "w-8 h-8 text-sm",
  lg: "w-10 h-10 text-base",
} as const;

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function Avatar({ nombre, size = "md" }: { nombre: string; size?: "sm" | "md" | "lg" }) {
  const bg = COLORS[hashName(nombre) % 6];
  return (
    <div
      className={`${SIZES[size]} rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0`}
      style={{ backgroundColor: bg }}
    >
      {getInitials(nombre)}
    </div>
  );
}
