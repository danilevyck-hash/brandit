// Formatters del módulo Ventas. (Las funciones de heatmap/quarters viejas se
// eliminaron junto al módulo anterior.)

export function fmtMoney(n: number | null | undefined): string {
  if (n == null) return "—";
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtMoneyCompact(n: number | null | undefined): string {
  if (n == null) return "—";
  return "$" + Math.round(n).toLocaleString("en-US");
}

export function fmtPct(d: number | null | undefined): string {
  if (d == null) return "—";
  return (d >= 0 ? "+" : "") + (d * 100).toFixed(0) + "%";
}

export function fmtInt(n: number | null | undefined): string {
  if (n == null) return "—";
  return Math.round(n).toLocaleString("en-US");
}
