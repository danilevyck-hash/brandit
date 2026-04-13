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
  fecha: string;
  cliente: string;
  atencion: string | null;
  estado: string;
  aprobado_por: string | null;
  aprobado_at: string | null;
  items: NotaItem[];
};

export function generateNotaPDF(nota: Nota, firmaBase64?: string | null) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header - Company logo
  try {
    doc.addImage(LOGO_CB, "PNG", 14, 10, 35, 35);
  } catch {
    // Fallback to text if logo fails
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(35, 31, 32);
    doc.text("CONFECCIONES", 14, 20);
    doc.text("BOSTON", 14, 28);
  }
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text("RUC 655-544-133465 DV13", 14, 48);

  // Top right - Date and nota number
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text(`Panamá, ${formatDate(nota.fecha)}`, pageWidth - 14, 20, { align: "right" });

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(241, 90, 41); // brandit-orange
  doc.text(nota.numero, pageWidth - 14, 30, { align: "right" });

  // Line separator
  doc.setDrawColor(230, 230, 230);
  doc.setLineWidth(0.5);
  doc.line(14, 52, pageWidth - 14, 52);

  // Client info
  let y = 60;
  doc.setFontSize(11);
  doc.setTextColor(35, 31, 32);
  doc.setFont("helvetica", "bold");
  doc.text("Cliente:", 14, y);
  doc.setFont("helvetica", "normal");
  doc.text(nota.cliente, 40, y);

  if (nota.atencion) {
    y += 7;
    doc.setFont("helvetica", "bold");
    doc.text("Nota al cliente:", 14, y);
    doc.setFont("helvetica", "normal");
    // Handle long text
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

  y = ((doc as unknown as Record<string, Record<string, number>>).lastAutoTable?.finalY ?? y + 30) + 20;

  // "Recibido por" section
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(35, 31, 32);
  doc.text("Recibido por:", 14, y);

  y += 10;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text("Nombre: ___________________________", 14, y);
  y += 10;
  doc.text("Firma:    ___________________________", 14, y);
  y += 10;
  doc.text("Fecha:    ___________________________", 14, y);

  // "Aprobado por" section on the right
  const rightX = pageWidth / 2 + 10;
  y -= 30; // Go back up to align with "Recibido por"

  doc.setFont("helvetica", "bold");
  doc.setTextColor(35, 31, 32);
  doc.text("APROBADO POR:", rightX, y);

  y += 10;
  if (nota.aprobado_por) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(35, 31, 32);

    // Draw signature if available
    if (firmaBase64) {
      try {
        const format = firmaBase64.includes("image/jpeg") ? "JPEG" : "PNG";
        doc.addImage(firmaBase64, format, rightX, y - 5, 50, 20);
        y += 18;
      } catch (e) {
        console.error("Error adding signature to PDF:", e);
        y += 2;
      }
    }

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(nota.aprobado_por, rightX, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.text("Gerente General", rightX, y);
  } else {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.text("___________________________", rightX, y);
    y += 6;
    doc.text("Gerente General", rightX, y);
  }

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(200, 200, 200);
  doc.text("Confecciones Boston", pageWidth / 2, pageHeight - 10, { align: "center" });

  doc.save(`Nota_Entrega_${nota.numero}_${nota.cliente.replace(/\s+/g, "_")}.pdf`);
}
