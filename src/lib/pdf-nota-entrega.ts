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

// Brandit orange for accents
const ORANGE: [number, number, number] = [241, 90, 41];
const BLACK: [number, number, number] = [30, 27, 28];
const MID: [number, number, number] = [100, 100, 100];
const LIGHT: [number, number, number] = [160, 160, 160];
const LINE_GRAY: [number, number, number] = [220, 220, 220];

export function generateNotaPDF(nota: Nota, firmaBase64?: string | null) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  // ─────────── HEADER ───────────
  // Logo left (26×52 — preserves 1:2 aspect ratio of the source PNG)
  const LOGO_W = 26;
  const LOGO_H = 52;
  try {
    doc.addImage(LOGO_CB, "PNG", margin, 12, LOGO_W, LOGO_H);
  } catch {
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BLACK);
    doc.text("CONFECCIONES", margin, 22);
    doc.text("BOSTON", margin, 30);
  }

  // Company info to the right of logo
  const infoX = margin + LOGO_W + 6;
  let infoY = 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...BLACK);
  doc.text(COMPANY.legal_name, infoX, infoY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MID);
  infoY += 5;
  doc.text(`RUC: ${COMPANY.ruc}`, infoX, infoY);
  infoY += 4.5;
  doc.text(COMPANY.address, infoX, infoY);
  infoY += 4.5;
  doc.text(`Tel. ${COMPANY.phone}  ·  Cel. ${COMPANY.mobile}`, infoX, infoY);
  infoY += 4.5;
  doc.text(COMPANY.email, infoX, infoY);

  // Top-right — Document type label + number
  const rightX = pageWidth - margin;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...LIGHT);
  doc.text("NOTA DE ENTREGA", rightX, 18, { align: "right" });

  doc.setFontSize(22);
  doc.setTextColor(...ORANGE);
  doc.text(nota.numero, rightX, 28, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MID);
  doc.text(`Panamá, ${formatDate(nota.fecha)}`, rightX, 35, { align: "right" });

  // Tipo badge top-right below
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...ORANGE);
  const tipoLabel = nota.tipo === "muestras" ? "MUESTRAS" : "PEDIDO";
  doc.text(tipoLabel, rightX, 41, { align: "right" });

  // ─────────── SEPARATOR ───────────
  const headerBottom = 12 + LOGO_H + 4;
  doc.setDrawColor(...LINE_GRAY);
  doc.setLineWidth(0.5);
  doc.line(margin, headerBottom, pageWidth - margin, headerBottom);

  // ─────────── INTRO TEXT (full width) ───────────
  const tipo = nota.tipo === "muestras" ? "muestras" : "pedido";
  const introText = tipo === "muestras" ? INTRO_MUESTRAS : INTRO_PEDIDO;
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MID);
  const introLines = doc.splitTextToSize(introText, pageWidth - margin * 2);
  doc.text(introLines, margin, headerBottom + 6);
  const introHeight = introLines.length * 4.5;

  // ─────────── CLIENT BLOCK (2 columns) ───────────
  let y = headerBottom + 6 + introHeight + 6;
  const clientHeader = y;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...LIGHT);
  doc.text("DATOS DEL CLIENTE", margin, clientHeader);
  y += 5;

  const colMidX = pageWidth / 2;

  // Left column: Cliente, Atención, Número
  const labelColor: [number, number, number] = [80, 80, 80];
  const valueColor: [number, number, number] = [20, 20, 20];

  const drawField = (label: string, value: string, x: number, yPos: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...labelColor);
    doc.text(label, x, yPos);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...valueColor);
    doc.text(value || "—", x, yPos + 4.5);
  };

  drawField("Cliente", nota.cliente, margin, y);
  drawField("Atención", nota.contacto || "—", colMidX, y);
  y += 11;

  drawField("Número", formatPhone(nota.numero_contacto), margin, y);
  drawField("Fecha de emisión", formatDate(nota.fecha), colMidX, y);
  y += 11;

  if (nota.atencion) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...labelColor);
    doc.text("Nota al cliente", margin, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...valueColor);
    const noteLines = doc.splitTextToSize(nota.atencion, pageWidth - margin * 2);
    doc.text(noteLines, margin, y + 4.5);
    y += 4.5 + noteLines.length * 4.5 + 3;
  }

  // ─────────── ITEMS TABLE ───────────
  y += 5;
  const totalCantidad = nota.items.reduce((sum, i) => sum + Number(i.cantidad), 0);

  const rows = nota.items.map((item, idx) => [
    String(idx + 1),
    item.marca || "—",
    item.descripcion,
    item.color || "—",
    item.talla || "—",
    String(item.cantidad),
  ]);

  // Only show TOTAL footer row if more than one item
  const showTotal = nota.items.length > 1;
  const footRow = showTotal
    ? [["", "", "", "", "TOTAL UNIDADES", String(totalCantidad)]]
    : undefined;

  autoTable(doc, {
    startY: y,
    head: [["#", "MARCA", "DESCRIPCIÓN", "COLOR", "TALLA", "CANT."]],
    body: rows,
    foot: footRow,
    theme: "grid",
    headStyles: {
      fillColor: BLACK,
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: "bold",
      cellPadding: { top: 2.5, right: 2, bottom: 2.5, left: 3 },
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [40, 40, 40],
      cellPadding: { top: 3, right: 2, bottom: 3, left: 3 },
    },
    footStyles: {
      fillColor: [248, 248, 248],
      textColor: BLACK,
      fontSize: 9.5,
      fontStyle: "bold",
      cellPadding: { top: 2.5, right: 2, bottom: 2.5, left: 3 },
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 28 },
      3: { cellWidth: 24 },
      4: { cellWidth: 18, halign: "center" },
      5: { cellWidth: 18, halign: "center" },
    },
    margin: { left: margin, right: margin },
  });

  y = ((doc as unknown as Record<string, Record<string, number>>).lastAutoTable?.finalY ?? y + 30) + 20;

  // ─────────── SIGNATURE BLOCK (3 columns, tight) ───────────
  const usableWidth = pageWidth - margin * 2;
  const sigGap = 6;
  const colWidth = (usableWidth - sigGap * 2) / 3;
  const col1X = margin;
  const col2X = margin + colWidth + sigGap;
  const col3X = margin + (colWidth + sigGap) * 2;
  const sigBoxH = 18; // height for actual signature

  // Column labels
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...LIGHT);
  doc.text("APROBADO POR", col1X, y);
  doc.text("BODEGA", col2X, y);
  doc.text("CLIENTE", col3X, y);

  // Signature box for admin (with the digital signature image)
  const boxTop = y + 3;
  const lineY = boxTop + sigBoxH;

  // Draw admin signature image centered in its box (if exists)
  if (nota.aprobado_por && firmaBase64) {
    try {
      const fmt = firmaBase64.includes("image/jpeg") ? "JPEG" : "PNG";
      // Place signature so it sits just above the line
      doc.addImage(firmaBase64, fmt, col1X + 4, boxTop + 2, colWidth - 8, sigBoxH - 4);
    } catch (e) {
      console.error("Error adding signature to PDF:", e);
    }
  }

  // Horizontal signature lines (all 3 columns)
  doc.setDrawColor(...BLACK);
  doc.setLineWidth(0.4);
  doc.line(col1X, lineY, col1X + colWidth, lineY);
  doc.line(col2X, lineY, col2X + colWidth, lineY);
  doc.line(col3X, lineY, col3X + colWidth, lineY);

  // Under-line labels (tight against the line)
  const underY1 = lineY + 4;
  const underY2 = lineY + 8;
  const underY3 = lineY + 12;

  // Column 1 — admin (already signed)
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BLACK);
  doc.text(nota.aprobado_por || "________________", col1X, underY1);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...MID);
  doc.text("Gerente General", col1X, underY2);

  // Column 2 — Bodega (physical fill-in)
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MID);
  doc.text("Nombre:", col2X, underY1);
  doc.setDrawColor(...LINE_GRAY);
  doc.setLineWidth(0.2);
  doc.line(col2X + 12, underY1, col2X + colWidth, underY1);
  doc.text("Cédula:", col2X, underY2);
  doc.line(col2X + 12, underY2, col2X + colWidth, underY2);
  doc.text("Fecha:", col2X, underY3);
  doc.line(col2X + 12, underY3, col2X + colWidth, underY3);

  // Column 3 — Cliente (physical fill-in)
  doc.text("Nombre:", col3X, underY1);
  doc.line(col3X + 12, underY1, col3X + colWidth, underY1);
  doc.text("Cédula:", col3X, underY2);
  doc.line(col3X + 12, underY2, col3X + colWidth, underY2);
  doc.text("Fecha:", col3X, underY3);
  doc.line(col3X + 12, underY3, col3X + colWidth, underY3);

  // ─────────── THANK YOU LINE ───────────
  const thankY = underY3 + 10;
  if (thankY < pageHeight - 40) {
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(...LIGHT);
    doc.text("Gracias por su preferencia", pageWidth / 2, thankY, { align: "center" });
  }

  // ─────────── POLICY (bottom) ───────────
  const policyText = tipo === "muestras" ? POLICY_MUESTRAS : POLICY_PEDIDO;
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(140, 140, 140);
  const policyLines = doc.splitTextToSize(policyText, pageWidth - margin * 2);
  const policyHeight = policyLines.length * 3.3;
  const policyY = pageHeight - 12 - policyHeight;

  // Separator above policy
  doc.setDrawColor(...LINE_GRAY);
  doc.setLineWidth(0.3);
  doc.line(margin, policyY - 4, pageWidth - margin, policyY - 4);
  doc.text(policyLines, margin, policyY);

  // ─────────── PAGE NUMBER (bottom right) ───────────
  doc.setFontSize(7);
  doc.setTextColor(...LIGHT);
  doc.text("Página 1 de 1", pageWidth - margin, pageHeight - 6, { align: "right" });

  // Save
  doc.save(`Nota_Entrega_${nota.numero}_${nota.cliente.replace(/\s+/g, "_")}.pdf`);
}
