export interface PedidoProduccion {
  id: string;
  cliente: string;
  tipo: string;
  trabajador: string | null;
  estado: string;
  fecha_entrega: string | null;
  notas: string | null;
  orden: number;
  created_by: string | null;
  created_at: string;
}

export interface Trabajador {
  id: string;
  nombre: string;
  created_at: string;
}

export interface TipoConfig {
  name: string;
  dot: string;
  bg: string;
  text: string;
}

// Tipos de personalización del taller. Los colores replican el prototipo.
export const TIPOS: TipoConfig[] = [
  { name: "DTF", dot: "#e8621a", bg: "#fdeee4", text: "#b14310" },
  { name: "UV DTF", dot: "#0ea5a4", bg: "#e3f6f5", text: "#0b7c7b" },
  { name: "Sublimación", dot: "#5b8fa8", bg: "#e8f0f4", text: "#3c6679" },
  { name: "Bordado", dot: "#7c5ccf", bg: "#efeafb", text: "#5a3f9e" },
  { name: "Grabado láser", dot: "#64748b", bg: "#eef1f5", text: "#475569" },
  { name: "Gran formato", dot: "#3f9b54", bg: "#e6f4ea", text: "#2c6e3c" },
  { name: "Confección", dot: "#182552", bg: "#e8eaf2", text: "#182552" },
];

export const TIPO_NAMES = TIPOS.map((t) => t.name);

export function tipoStyle(name: string): TipoConfig {
  return TIPOS.find((t) => t.name === name) || TIPOS[0];
}

export interface EstadoConfig {
  bg: string;
  text: string;
}

export const ESTADOS: Record<string, EstadoConfig> = {
  Pendiente: { bg: "#eef1f5", text: "#6b7280" },
  "En proceso": { bg: "#fdeee4", text: "#b14310" },
  Listo: { bg: "#e6f4ea", text: "#2c6e3c" },
};

export const ORDEN_ESTADO = ["Pendiente", "En proceso", "Listo"];
