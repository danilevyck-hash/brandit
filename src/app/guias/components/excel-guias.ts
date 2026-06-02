// Export de Guías a Excel (Brand It) — reescrito con exceljs (xlsx-js-style
// no está instalado). Mono-empresa: se eliminó la columna EMPRESA del original.
// Mismo nombre de archivo y firma de export que usa GuiasList; corre en cliente
// (writeBuffer → Blob → descarga), igual que la versión anterior.

import ExcelJS from "exceljs";
import type { Guia, GuiaItem } from "./types";

// Paleta (ARGB para exceljs)
const PRI = "FF1B3A5C";
const MID = "FF2E5E8E";
const SEP = "FFD4E6F1";
const DATA_BG = "FFF8F9F9";
const ALT_BG = "FFFFFFFF";

const BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFD5DBDB" } },
  bottom: { style: "thin", color: { argb: "FFD5DBDB" } },
  left: { style: "thin", color: { argb: "FFD5DBDB" } },
  right: { style: "thin", color: { argb: "FFD5DBDB" } },
};

function fmtDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function fmtGuia(n: number) {
  return `GT-${String(n).padStart(3, "0")}`;
}

function clientesSummary(items: GuiaItem[]): string {
  if (!items || items.length === 0) return "";
  const unique = Array.from(new Set(items.map((i) => i.cliente).filter(Boolean)));
  if (unique.length === 0) return "";
  if (unique.length === 1) return unique[0];
  return `${unique[0]} y ${unique.length - 1} mas`;
}

function facturasSummary(items: GuiaItem[]): string {
  if (!items || items.length === 0) return "";
  const all = items.map((i) => i.facturas).filter(Boolean);
  return all.join(", ");
}

export async function exportGuiasExcel(guias: Guia[], subtitle?: string) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Guías");

  const lastCol = 7; // 7 columnas (1-7)

  ws.getColumn(1).width = 12; // N Guia
  ws.getColumn(2).width = 12; // Fecha
  ws.getColumn(3).width = 20; // Transportista
  ws.getColumn(4).width = 24; // Clientes
  ws.getColumn(5).width = 28; // Facturas
  ws.getColumn(6).width = 10; // Bultos
  ws.getColumn(7).width = 16; // Estado

  let r = 1;

  // Title row
  ws.mergeCells(r, 1, r, lastCol);
  const titleCell = ws.getCell(r, 1);
  titleCell.value = "Confecciones Boston — Guías de Transporte";
  titleCell.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" }, name: "Calibri" };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PRI } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(r).height = 30;
  r++;

  // Subtitle row
  ws.mergeCells(r, 1, r, lastCol);
  const subCell = ws.getCell(r, 1);
  subCell.value = subtitle || "Todas las guías";
  subCell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" }, name: "Calibri" };
  subCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MID } };
  subCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(r).height = 20;
  r++;

  // Separator
  ws.mergeCells(r, 1, r, lastCol);
  const sepCell = ws.getCell(r, 1);
  sepCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SEP } };
  ws.getRow(r).height = 4;
  r++;

  // Header row
  const headers = ["N° Guía", "Fecha", "Transportista", "Clientes", "Facturas", "Bultos", "Estado"];
  headers.forEach((h, i) => {
    const cell = ws.getCell(r, i + 1);
    cell.value = h;
    cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" }, name: "Calibri" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PRI } };
    cell.alignment = { horizontal: i === 5 ? "right" : "left", vertical: "middle" };
    cell.border = BORDER;
  });
  ws.getRow(r).height = 22;
  r++;

  // Data rows
  let totalBultos = 0;
  guias.forEach((g, idx) => {
    const alt = idx % 2 === 0;
    const bg = alt ? DATA_BG : ALT_BG;
    const items = g.guia_items || [];

    const setText = (c: number, v: string, fg: string, opts: { bold?: boolean; sz?: number } = {}) => {
      const cell = ws.getCell(r, c);
      cell.value = v;
      cell.font = { size: opts.sz || 10, bold: opts.bold || false, color: { argb: fg }, name: "Calibri" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cell.alignment = { horizontal: "left" };
      cell.border = BORDER;
    };

    setText(1, fmtGuia(g.numero), PRI, { bold: true, sz: 10 });
    setText(2, fmtDate(g.fecha), "FF555555", { sz: 9 });
    setText(3, g.transportista || "", "FF333333");
    setText(4, clientesSummary(items), "FF444444", { sz: 9 });
    setText(5, facturasSummary(items), "FF666666", { sz: 9 });

    const bultosCell = ws.getCell(r, 6);
    bultosCell.value = g.total_bultos || 0;
    bultosCell.font = { size: 10, color: { argb: "FF333333" }, name: "Calibri" };
    bultosCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
    bultosCell.alignment = { horizontal: "right" };
    bultosCell.border = BORDER;

    const estadoFg = g.estado === "Completada" ? "FF15803D" : g.estado === "Rechazada" ? "FFDC2626" : "FFC2410C";
    setText(7, g.estado || "", estadoFg, { sz: 9 });

    totalBultos += g.total_bultos || 0;
    ws.getRow(r).height = 18;
    r++;
  });

  // Spacer
  ws.getRow(r).height = 6;
  r++;

  // Totals row
  const totLabel = ws.getCell(r, 1);
  totLabel.value = `${guias.length} guías`;
  totLabel.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" }, name: "Calibri" };
  totLabel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PRI } };
  totLabel.alignment = { horizontal: "left", vertical: "middle" };
  totLabel.border = BORDER;
  for (let c = 2; c <= 5; c++) {
    const cell = ws.getCell(r, c);
    cell.value = "";
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PRI } };
    cell.border = BORDER;
  }
  const totBultos = ws.getCell(r, 6);
  totBultos.value = totalBultos;
  totBultos.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" }, name: "Calibri" };
  totBultos.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PRI } };
  totBultos.alignment = { horizontal: "right", vertical: "middle" };
  totBultos.border = BORDER;
  const totEstado = ws.getCell(r, 7);
  totEstado.value = "";
  totEstado.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PRI } };
  totEstado.border = BORDER;
  ws.getRow(r).height = 22;
  r++;

  // Build and download
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const date = new Date().toISOString().slice(0, 10);
  a.download = `guias-transporte-${date}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
