export function formatCurrency(amount: number): string {
  return "$" + amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return "-";
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

// ── Caja module helpers (mirror fashiongr's fmt / fmtDate) ──
export function fmt(n: number | undefined | null): string {
  return (n ?? 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// "5 abr 2026"
export function fmtDate(d: string): string {
  if (!d) return "";
  try {
    const date = new Date(d + "T12:00:00");
    return date
      .toLocaleDateString("es-PA", { day: "numeric", month: "short", year: "numeric" })
      .replace(".", "");
  } catch {
    return d;
  }
}

export function fmtGuia(n: number): string {
  return `GT-${String(n).padStart(3, "0")}`;
}
