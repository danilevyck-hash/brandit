"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDate } from "@/lib/format";
import { LOGO_CB } from "@/lib/logo-cb";

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
  "Por medio de la presente se hace entrega al cliente de los siguientes artículos correspondientes a su pedido. Favor revisar el contenido antes de firmar.";
const INTRO_MUESTRAS =
  "Por medio de la presente se hace entrega al cliente de las siguientes muestras para evaluación. Las muestras se entregan sin costo y deben ser devueltas o confirmada su recepción conforme a la política de la empresa.";

const POLICY_PEDIDO =
  "POLÍTICA DE ENTREGA — PEDIDO: Al firmar esta nota el cliente confirma haber recibido los artículos descritos en buen estado y en las cantidades indicadas. Cualquier reclamo por faltantes, defectos o diferencias debe realizarse dentro de las 48 horas posteriores a la recepción; pasado este plazo no se aceptarán reclamos. La mercancía entregada no admite devoluciones sin autorización previa de Confecciones Boston.";
const POLICY_MUESTRAS =
  "POLÍTICA DE ENTREGA — MUESTRAS: Las muestras entregadas son propiedad de Confecciones Boston y se facilitan únicamente con fines de evaluación. El cliente se compromete a devolverlas en un plazo máximo de 15 días calendario en las mismas condiciones en que fueron entregadas. De no ser devueltas en ese plazo, Confecciones Boston podrá facturarlas al precio regular sin previo aviso. Las muestras no podrán ser reproducidas, comercializadas ni transferidas a terceros sin autorización escrita.";

export function generateNotaPDF(nota: Nota, firmaBase64?: string | null) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header - Company logo
  try {
    doc.addImage(LOGO_CB, "PNG", 14, 10, 17.5, 35);
  } catch {
    // Fallback to text if logo fails
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(35, 31, 32);
    doc.text("CONFECCIONES", 14, 20);
    doc.text("BOSTON", 14, 28);
  }
  // Top right - Date and nota number
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text(`Panamá, ${formatDate(nota.fecha)}`, pageWidth - 14, 20, { align: "right" });

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(241, 90, 41); // brandit-orange
  doc.text(nota.numero, pageWidth - 14, 30, { align: "right" });

  // Intro text based on tipo
  const tipo = nota.tipo === "muestras" ? "muestras" : "pedido";
  const introText = tipo === "muestras" ? INTRO_MUESTRAS : INTRO_PEDIDO;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  const introLines = doc.splitTextToSize(introText, pageWidth - 68);
  doc.text(introLines, 52, 48);

  // Line separator
  const introHeight = introLines.length * 4;
  doc.setDrawColor(230, 230, 230);
  doc.setLineWidth(0.5);
  doc.line(14, 52 + introHeight, pageWidth - 14, 52 + introHeight);

  // Client info block
  let y = 60 + introHeight;
  doc.setFontSize(11);
  doc.setTextColor(35, 31, 32);
  doc.setFont("helvetica", "bold");
  doc.text("Cliente:", 14, y);
  doc.setFont("helvetica", "normal");
  doc.text(nota.cliente, 45, y);

  if (nota.contacto) {
    y += 7;
    doc.setFont("helvetica", "bold");
    doc.text("Atención:", 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(nota.contacto, 45, y);
  }

  if (nota.numero_contacto) {
    y += 7;
    doc.setFont("helvetica", "bold");
    doc.text("Número:", 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(nota.numero_contacto, 45, y);
  }

  if (nota.atencion) {
    y += 7;
    doc.setFont("helvetica", "bold");
    doc.text("Nota al cliente:", 14, y);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(nota.atencion, pageWidth - 60);
    doc.text(lines, 55, y);
    y += (lines.length - 1) * 5;
  }

  // Items table
  y += 12;
  const totalCantidad = nota.items.reduce((sum, i) => sum + Number(i.cantidad), 0);

  autoTable(doc, {
    startY: y,
    head: [["MARCA", "DESCRIPCION", "COLOR", "TALLA", "CANTIDAD"]],
    body: nota.items.map((item) => [
      item.marca || "",
      item.descripcion,
      item.color || "",
      item.talla || "",
      String(item.cantidad),
    ]),
    foot: [["", "", "", "TOTAL", String(totalCantidad)]],
    theme: "grid",
    headStyles: {
      fillColor: [35, 31, 32],
      fontSize: 9,
      fontStyle: "bold",
    },
    bodyStyles: { fontSize: 9 },
    footStyles: {
      fillColor: [245, 245, 245],
      textColor: [35, 31, 32],
      fontSize: 10,
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 30 },
      4: { halign: "center", cellWidth: 25 },
    },
    margin: { left: 14, right: 14 },
  });

  y = ((doc as unknown as Record<string, Record<string, number>>).lastAutoTable?.finalY ?? y + 30) + 25;

  // Three signature columns: Admin (digital) | Bodega | Cliente
  const usableWidth = pageWidth - 28; // 14 margin each side
  const colWidth = usableWidth / 3;
  const col1X = 14;
  const col2X = 14 + colWidth;
  const col3X = 14 + colWidth * 2;
  const signatureLineY = y + 22;
  const lineLength = colWidth - 10;

  // Column 1: Aprobado por (admin — digital signature)
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(35, 31, 32);
  doc.text("APROBADO POR:", col1X, y);

  if (nota.aprobado_por && firmaBase64) {
    try {
      const format = firmaBase64.includes("image/jpeg") ? "JPEG" : "PNG";
      doc.addImage(firmaBase64, format, col1X, y + 4, 45, 18);
    } catch (e) {
      console.error("Error adding signature to PDF:", e);
    }
  }

  doc.setDrawColor(35, 31, 32);
  doc.setLineWidth(0.3);
  doc.line(col1X, signatureLineY, col1X + lineLength, signatureLineY);

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(35, 31, 32);
  doc.text(nota.aprobado_por || "", col1X, signatureLineY + 5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text("Gerente General", col1X, signatureLineY + 10);

  // Column 2: Bodega (physical signature)
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(35, 31, 32);
  doc.text("BODEGA:", col2X, y);

  doc.line(col2X, signatureLineY, col2X + lineLength, signatureLineY);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.setFontSize(8);
  doc.text("Nombre y firma", col2X, signatureLineY + 5);
  doc.text("Fecha: _______________", col2X, signatureLineY + 10);

  // Column 3: Cliente (physical signature)
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(35, 31, 32);
  doc.text("CLIENTE:", col3X, y);

  doc.line(col3X, signatureLineY, col3X + lineLength, signatureLineY);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.setFontSize(8);
  doc.text("Nombre y firma", col3X, signatureLineY + 5);
  doc.text("Fecha: _______________", col3X, signatureLineY + 10);

  // Policy footer (based on tipo)
  const pageHeight = doc.internal.pageSize.getHeight();
  const policyText = tipo === "muestras" ? POLICY_MUESTRAS : POLICY_PEDIDO;
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  const policyLines = doc.splitTextToSize(policyText, pageWidth - 28);
  const policyHeight = policyLines.length * 3;
  const policyY = pageHeight - 16 - policyHeight;
  doc.text(policyLines, 14, policyY);

  // Bottom brand line
  doc.setFontSize(8);
  doc.setTextColor(200, 200, 200);
  doc.text("Confecciones Boston", pageWidth / 2, pageHeight - 8, { align: "center" });

  doc.save(`Nota_Entrega_${nota.numero}_${nota.cliente.replace(/\s+/g, "_")}.pdf`);
}
