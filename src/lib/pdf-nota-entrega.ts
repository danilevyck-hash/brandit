"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDate } from "@/lib/format";
import { LOGO_CB } from "@/lib/logo-cb";
import { COMPANY, formatPhone } from "@/lib/company-info";

type NotaItem = {
  marca: string | null;
  descripcion: string;
  color: string | null;
  talla: string | null;
  cantidad: number;
};

type Nota = {
  id: number;
  numero: string;
  tipo: "muestras" | "pedido" | null;
  fecha: string;
  cliente: string;
  contacto: string | null;
  numero_contacto: string | null;
  atencion: string | null;
  estado: string;
  aprobado_por: string | null;
  aprobado_at: string | null;
  items: NotaItem[];
};

const INTRO_PEDIDO =
  "Por medio de la presente, se hace entrega al cliente de los siguientes artículos correspondientes a su pedido. Favor revisar el contenido antes de firmar.";
const INTRO_MUESTRAS =
  "Por medio de la presente, se hace entrega al cliente de las siguientes muestras para evaluación. Las muestras se entregan sin costo y deben ser devueltas o confirmada su recepción conforme a la política de la empresa.";

const POLICY_PEDIDO =
  "POLÍTICA DE ENTREGA — PEDIDO: Al firmar esta nota el cliente confirma haber recibido los artículos descritos en buen estado y en las cantidades indicadas. Cualquier reclamo por faltantes, defectos o diferencias debe realizarse dentro de las 48 horas posteriores a la recepción; pasado este plazo no se aceptarán reclamos. La mercancía entregada no admite devoluciones sin autorización previa de Confecciones Boston.";
const POLICY_MUESTRAS =
  "POLÍTICA DE ENTREGA — MUESTRAS: Las muestras entregadas son propiedad de Confecciones Boston y se facilitan únicamente con fines de evaluación. El cliente se compromete a devolverlas en un plazo máximo de 15 días calendario en las mismas condiciones en que fueron entregadas. De no ser devueltas en ese plazo, Confecciones Boston podrá facturarlas al precio regular sin previo aviso. Las muestras no podrán ser reproducidas, comercializadas ni transferidas a terceros sin autorización escrita.";

// ─────────── LUXURY COLOR PALETTE ───────────
const INK: [number, number, number] = [28, 28, 32];         // primary text — near-black charcoal
const MUTED: [number, number, number] = [110, 110, 118];    // secondary text
const SOFT: [number, number, number] = [165, 165, 172];     // tertiary / labels
const HAIRLINE: [number, number, number] = [210, 210, 215]; // thin dividers
const ACCENT: [number, number, number] = [241, 90, 41];     // brandit orange — used sparingly
const IVORY: [number, number, number] = [250, 249, 246];    // warm off-white (table zebra)

// Wide letter-spacing for uppercase labels (luxury fashion feel)
const LETTER_SPACE = 1.2;

export function generateNotaPDF(nota: Nota, firmaBase64?: string | null) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const tipo = nota.tipo === "muestras" ? "muestras" : "pedido";

  // ─────────── HEADER ───────────
  // Logo left — 26×52 to preserve source PNG aspect (1:2)
  const LOGO_W = 26;
  const LOGO_H = 52;
  const logoY = 14;
  try {
    doc.addImage(LOGO_CB, "PNG", margin, logoY, LOGO_W, LOGO_H);
  } catch {
    doc.setFontSize(18);
    doc.setFont("times", "bold");
    doc.setTextColor(...INK);
    doc.text("CONFECCIONES", margin, logoY + 10);
    doc.text("BOSTON", margin, logoY + 18);
  }

  // Company block right of logo — refined serif + fine print
  const infoX = margin + LOGO_W + 8;

  // Company name in elegant serif
  doc.setFont("times", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...INK);
  doc.text(COMPANY.legal_name.toUpperCase(), infoX, logoY + 6);

  // Thin hairline under company name
  doc.setDrawColor(...HAIRLINE);
  doc.setLineWidth(0.2);
  const nameLineY = logoY + 8.5;
  doc.line(infoX, nameLineY, infoX + 80, nameLineY);

  // Contact details in small helvetica
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  let infoY = logoY + 13;
  doc.text(`RUC  ${COMPANY.ruc}`, infoX, infoY);
  infoY += 4;
  doc.text(COMPANY.address, infoX, infoY);
  infoY += 4;
  doc.text(`T.  ${COMPANY.phone}`, infoX, infoY);
  infoY += 4;
  doc.text(COMPANY.email, infoX, infoY);

  // ─────────── RIGHT-SIDE DOCUMENT BLOCK ───────────
  const rightX = pageWidth - margin;

  // "NOTA DE ENTREGA" — tiny uppercase with wide letter-spacing
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...SOFT);
  doc.setCharSpace(LETTER_SPACE);
  doc.text("NOTA DE ENTREGA", rightX, logoY + 4, { align: "right" });
  doc.setCharSpace(0);

  // Number — large Times Roman
  doc.setFont("times", "normal");
  doc.setFontSize(26);
  doc.setTextColor(...INK);
  doc.text(nota.numero, rightX, logoY + 16, { align: "right" });

  // Thin underline below number (accent)
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(0.6);
  const numWidth = doc.getTextWidth(nota.numero);
  doc.line(rightX - numWidth, logoY + 18, rightX, logoY + 18);

  // Tipo badge — italic serif small
  doc.setFont("times", "italic");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  const tipoLabel = tipo === "muestras" ? "Entrega de muestras" : "Entrega de pedido";
  doc.text(tipoLabel, rightX, logoY + 24, { align: "right" });

  // Date — fine print below badge
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...SOFT);
  doc.text(`Panamá, ${formatDate(nota.fecha)}`, rightX, logoY + 30, { align: "right" });

  // ─────────── HEADER BOTTOM RULE ───────────
  const headerBottom = logoY + LOGO_H + 4;
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.3);
  doc.line(margin, headerBottom, pageWidth - margin, headerBottom);

  // ─────────── INTRO (refined serif italic) ───────────
  const introText = tipo === "muestras" ? INTRO_MUESTRAS : INTRO_PEDIDO;
  doc.setFont("times", "italic");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  const introLines = doc.splitTextToSize(introText, pageWidth - margin * 2);
  doc.text(introLines, margin, headerBottom + 7);
  const introHeight = introLines.length * 5;

  // ─────────── CLIENT BLOCK ───────────
  let y = headerBottom + 7 + introHeight + 9;

  // Section label with letter-spacing
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...SOFT);
  doc.setCharSpace(LETTER_SPACE);
  doc.text("DATOS DEL CLIENTE", margin, y);
  doc.setCharSpace(0);

  // Thin hairline under section label
  doc.setDrawColor(...HAIRLINE);
  doc.setLineWidth(0.2);
  doc.line(margin, y + 1.5, pageWidth - margin, y + 1.5);

  y += 7;

  const colMidX = pageWidth / 2 + 4;

  const drawField = (label: string, value: string, x: number, yPos: number) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...SOFT);
    doc.setCharSpace(LETTER_SPACE);
    doc.text(label.toUpperCase(), x, yPos);
    doc.setCharSpace(0);
    doc.setFont("times", "normal");
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text(value || "—", x, yPos + 5);
  };

  drawField("Cliente", nota.cliente, margin, y);
  drawField("Atención", nota.contacto || "—", colMidX, y);
  y += 12;

  drawField("Número", formatPhone(nota.numero_contacto), margin, y);
  drawField("Fecha", formatDate(nota.fecha), colMidX, y);
  y += 12;

  if (nota.atencion) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...SOFT);
    doc.setCharSpace(LETTER_SPACE);
    doc.text("NOTA AL CLIENTE", margin, y);
    doc.setCharSpace(0);
    doc.setFont("times", "italic");
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    const noteLines = doc.splitTextToSize(nota.atencion, pageWidth - margin * 2);
    doc.text(noteLines, margin, y + 5);
    y += 5 + noteLines.length * 4.5 + 4;
  }

  // ─────────── ITEMS TABLE ───────────
  y += 3;

  // Section label above table
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...SOFT);
  doc.setCharSpace(LETTER_SPACE);
  doc.text("DETALLE DE ARTÍCULOS", margin, y);
  doc.setCharSpace(0);
  y += 4;

  const totalCantidad = nota.items.reduce((sum, i) => sum + Number(i.cantidad), 0);

  const rows = nota.items.map((item, idx) => [
    String(idx + 1).padStart(2, "0"),
    item.marca || "—",
    item.descripcion,
    item.color || "—",
    item.talla || "—",
    String(item.cantidad),
  ]);

  const showTotal = nota.items.length > 1;
  const footRow = showTotal
    ? [["", "", "", "", "TOTAL UNIDADES", String(totalCantidad)]]
    : undefined;

  autoTable(doc, {
    startY: y,
    head: [["Nº", "MARCA", "DESCRIPCIÓN", "COLOR", "TALLA", "CANT."]],
    body: rows,
    foot: footRow,
    theme: "plain",
    styles: {
      font: "helvetica",
      lineColor: HAIRLINE,
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: SOFT,
      fontSize: 7,
      fontStyle: "bold",
      halign: "left",
      cellPadding: { top: 3, right: 3, bottom: 3, left: 3 },
      lineWidth: { bottom: 0.4 },
      lineColor: INK,
    },
    bodyStyles: {
      font: "times",
      fontSize: 11,
      textColor: INK,
      cellPadding: { top: 4, right: 3, bottom: 4, left: 3 },
      lineWidth: { bottom: 0.15 },
      lineColor: HAIRLINE,
    },
    alternateRowStyles: {
      fillColor: IVORY,
    },
    footStyles: {
      fillColor: [255, 255, 255],
      textColor: INK,
      fontSize: 8,
      fontStyle: "bold",
      cellPadding: { top: 4, right: 3, bottom: 4, left: 3 },
      lineWidth: { top: 0.4 },
      lineColor: INK,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center", fontStyle: "normal" },
      1: { cellWidth: 26 },
      3: { cellWidth: 22 },
      4: { cellWidth: 16, halign: "center" },
      5: { cellWidth: 16, halign: "right", fontStyle: "bold" },
    },
    margin: { left: margin, right: margin },
  });

  y = ((doc as unknown as Record<string, Record<string, number>>).lastAutoTable?.finalY ?? y + 30) + 18;

  // ─────────── SIGNATURE BLOCK (3 columns, refined) ───────────
  const usableWidth = pageWidth - margin * 2;
  const sigGap = 8;
  const colWidth = (usableWidth - sigGap * 2) / 3;
  const col1X = margin;
  const col2X = margin + colWidth + sigGap;
  const col3X = margin + (colWidth + sigGap) * 2;
  const sigBoxH = 20;

  // Column labels (uppercase with letter-spacing)
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...SOFT);
  doc.setCharSpace(LETTER_SPACE);
  doc.text("APROBADO POR", col1X, y);
  doc.text("BODEGA", col2X, y);
  doc.text("CLIENTE", col3X, y);
  doc.setCharSpace(0);

  // Hairline under section labels
  doc.setDrawColor(...HAIRLINE);
  doc.setLineWidth(0.2);
  doc.line(margin, y + 1.5, pageWidth - margin, y + 1.5);

  const boxTop = y + 4;
  const lineY = boxTop + sigBoxH;

  // Admin signature inside box (above line)
  if (nota.aprobado_por && firmaBase64) {
    try {
      const fmt = firmaBase64.includes("image/jpeg") ? "JPEG" : "PNG";
      doc.addImage(firmaBase64, fmt, col1X + 4, boxTop + 2, colWidth - 8, sigBoxH - 4);
    } catch (e) {
      console.error("Error adding signature to PDF:", e);
    }
  }

  // Fine signature lines (hairline)
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.3);
  doc.line(col1X, lineY, col1X + colWidth, lineY);
  doc.line(col2X, lineY, col2X + colWidth, lineY);
  doc.line(col3X, lineY, col3X + colWidth, lineY);

  // Admin name + title under line (serif)
  doc.setFont("times", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  doc.text(nota.aprobado_por || "", col1X, lineY + 5);
  doc.setFont("times", "italic");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("Gerente General", col1X, lineY + 10);

  // Bodega & Cliente fillable lines (thin hairlines, serif labels)
  const fillFields = (x: number) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...SOFT);
    doc.setCharSpace(LETTER_SPACE);
    doc.setDrawColor(...HAIRLINE);
    doc.setLineWidth(0.15);

    const labels = ["NOMBRE", "CÉDULA", "FECHA"];
    const ys = [lineY + 5, lineY + 10, lineY + 15];
    for (let i = 0; i < labels.length; i++) {
      doc.text(labels[i], x, ys[i]);
      doc.line(x + 14, ys[i], x + colWidth, ys[i]);
    }
    doc.setCharSpace(0);
  };

  fillFields(col2X);
  fillFields(col3X);

  // ─────────── CLOSING LINE (centered, serif italic) ───────────
  const closingY = lineY + 22;
  doc.setFont("times", "italic");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text("Gracias por su preferencia", pageWidth / 2, closingY, { align: "center" });

  // Decorative hairline around closing
  const ruleWidth = 30;
  doc.setDrawColor(...HAIRLINE);
  doc.setLineWidth(0.2);
  doc.line(pageWidth / 2 - 50, closingY - 1, pageWidth / 2 - 50 + ruleWidth, closingY - 1);
  doc.line(pageWidth / 2 + 50 - ruleWidth, closingY - 1, pageWidth / 2 + 50, closingY - 1);

  // ─────────── POLICY (bottom, fine print) ───────────
  const policyText = tipo === "muestras" ? POLICY_MUESTRAS : POLICY_PEDIDO;
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  const policyLines = doc.splitTextToSize(policyText, pageWidth - margin * 2);
  const policyHeight = policyLines.length * 3.2;
  const policyY = pageHeight - 14 - policyHeight;

  // Thin separator above policy
  doc.setDrawColor(...HAIRLINE);
  doc.setLineWidth(0.2);
  doc.line(margin, policyY - 4, pageWidth - margin, policyY - 4);
  doc.text(policyLines, margin, policyY);

  // ─────────── PAGE NUMBER ───────────
  doc.setFontSize(6.5);
  doc.setTextColor(...SOFT);
  doc.setFont("helvetica", "normal");
  doc.setCharSpace(LETTER_SPACE);
  doc.text("PÁGINA 1 DE 1", pageWidth - margin, pageHeight - 7, { align: "right" });
  doc.setCharSpace(0);

  doc.save(`Nota_Entrega_${nota.numero}_${nota.cliente.replace(/\s+/g, "_")}.pdf`);
}
