/**
 * Agrupa items por período de tiempo relativo a hoy (estilo Apple Reminders).
 * Devuelve solo los grupos no vacíos.
 *
 * Port del group-by-time de fashiongr. Las helpers de fechas (addDaysISO,
 * getEndOfWeek) se inlinean aquí — Brand It no tiene cheques-dates.
 */

// ── Date helpers (inlined desde cheques-dates de fashiongr) ──
function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function getStartOfWeek(todayISO: string): string {
  // Lunes de la semana actual. JS getUTCDay(): 0=domingo, 1=lunes...6=sábado
  const d = new Date(todayISO + "T00:00:00Z");
  const dayOfWeek = d.getUTCDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  d.setUTCDate(d.getUTCDate() - daysFromMonday);
  return d.toISOString().slice(0, 10);
}

function getEndOfWeek(todayISO: string): string {
  // Domingo de la semana actual.
  return addDaysISO(getStartOfWeek(todayISO), 6);
}

export interface TimeGroup<T> {
  key: string;
  label: string;
  items: T[];
  color: string; // tailwind text color for header
  bgColor: string; // tailwind bg color for header row
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // Monday = start
  const r = new Date(d);
  r.setDate(r.getDate() + diff);
  r.setHours(0, 0, 0, 0);
  return r;
}

function endOfWeek(d: Date): Date {
  const s = startOfWeek(d);
  s.setDate(s.getDate() + 6);
  return s;
}

type PresetMode = "pendiente" | "depositado" | "guias";

const GROUP_DEFS: Record<
  PresetMode,
  {
    key: string;
    label: string;
    color: string;
    bgColor: string;
    match: (
      dateStr: string,
      today: string,
      weekStart: string,
      weekEnd: string,
      nextWeekStart: string,
      nextWeekEnd: string,
      monthStart: string,
      monthEnd: string,
      yesterday: string,
    ) => boolean;
  }[]
> = {
  pendiente: [
    {
      key: "vencidos",
      label: "Vencidos",
      color: "text-red-600",
      bgColor: "bg-red-50",
      match: (d, today) => d < today,
    },
    {
      key: "hoy",
      label: "Hoy",
      color: "text-amber-600",
      bgColor: "bg-amber-50",
      match: (d, today) => d === today,
    },
    {
      key: "esta_semana",
      label: "Esta semana",
      color: "text-gray-700",
      bgColor: "bg-gray-50",
      // Semana calendario lun-dom. Excluye hoy porque tiene bucket propio.
      match: (d, today) => d > today && d <= getEndOfWeek(today),
    },
    {
      key: "proxima_semana",
      label: "Próxima semana",
      color: "text-gray-700",
      bgColor: "bg-gray-50",
      match: (d, today) => d > getEndOfWeek(today) && d <= addDaysISO(getEndOfWeek(today), 7),
    },
    {
      key: "mas_adelante",
      label: "Más adelante",
      color: "text-gray-400",
      bgColor: "bg-gray-50/50",
      match: (d, today) => d > addDaysISO(getEndOfWeek(today), 7),
    },
  ],
  depositado: [
    {
      key: "hoy",
      label: "Hoy",
      color: "text-gray-700",
      bgColor: "bg-gray-50",
      match: (d, today) => d === today,
    },
    {
      key: "esta_semana",
      label: "Esta semana",
      color: "text-gray-700",
      bgColor: "bg-gray-50",
      match: (d, today, weekStart) => d < today && d >= weekStart,
    },
    {
      key: "este_mes",
      label: "Este mes",
      color: "text-gray-700",
      bgColor: "bg-gray-50",
      match: (d, today, weekStart, _we, _nws, _nwe, monthStart) => d < weekStart && d >= monthStart,
    },
    {
      key: "anteriores",
      label: "Anteriores",
      color: "text-gray-400",
      bgColor: "bg-gray-50/50",
      match: (d, _today, _ws, _we, _nws, _nwe, monthStart) => d < monthStart,
    },
  ],
  guias: [
    {
      key: "hoy",
      label: "Hoy",
      color: "text-gray-700",
      bgColor: "bg-gray-50",
      match: (d, today) => d === today,
    },
    {
      key: "ayer",
      label: "Ayer",
      color: "text-gray-700",
      bgColor: "bg-gray-50",
      match: (d, _today, _ws, _we, _nws, _nwe, _ms, _me, yesterday) => d === yesterday,
    },
    {
      key: "esta_semana",
      label: "Esta semana",
      color: "text-gray-700",
      bgColor: "bg-gray-50",
      match: (d, today, weekStart, _we, _nws, _nwe, _ms, _me, yesterday) =>
        d < yesterday && d >= weekStart,
    },
    {
      key: "anteriores",
      label: "Anteriores",
      color: "text-gray-400",
      bgColor: "bg-gray-50/50",
      match: (d, _today, weekStart) => d < weekStart,
    },
  ],
};

export function groupByTimePeriod<T>(
  items: T[],
  dateField: keyof T,
  mode: PresetMode,
): TimeGroup<T>[] {
  const now = new Date();
  const today = toDateStr(now);

  const ws = startOfWeek(now);
  const we = endOfWeek(now);
  const weekStart = toDateStr(ws);
  const weekEnd = toDateStr(we);

  const nws = new Date(ws);
  nws.setDate(nws.getDate() + 7);
  const nwe = new Date(we);
  nwe.setDate(nwe.getDate() + 7);
  const nextWeekStart = toDateStr(nws);
  const nextWeekEnd = toDateStr(nwe);

  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const monthEnd = toDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  const yd = new Date(now);
  yd.setDate(yd.getDate() - 1);
  const yesterday = toDateStr(yd);

  const defs = GROUP_DEFS[mode];
  const groups: TimeGroup<T>[] = defs.map((def) => ({
    key: def.key,
    label: def.label,
    color: def.color,
    bgColor: def.bgColor,
    items: [],
  }));

  for (const item of items) {
    const dateVal = String(item[dateField] ?? "").slice(0, 10);
    for (let i = 0; i < defs.length; i++) {
      const def = defs[i];
      if (
        def.match(
          dateVal,
          today,
          weekStart,
          weekEnd,
          nextWeekStart,
          nextWeekEnd,
          monthStart,
          monthEnd,
          yesterday,
        )
      ) {
        groups[i].items.push(item);
        break;
      }
    }
  }

  // Devolver solo los grupos no vacíos.
  return groups.filter((g) => g.items.length > 0);
}
