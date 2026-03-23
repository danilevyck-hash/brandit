"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Quotation, QuotationItem, PrintJob } from "@/lib/supabase";
import { formatDate, formatCurrency } from "@/lib/format";

function materialCost(item: QuotationItem) {
  return (
    (item.fabric_qty || 0) * (item.fabric_price || 0) +
    (item.lining_qty || 0) * (item.lining_price || 0) +
    (item.thread_qty || 0) * (item.thread_price || 0) +
    (item.buttons_qty || 0) * (item.buttons_price || 0) +
    (item.packaging_qty || 0) * (item.packaging_price || 0)
  );
}

function totalCost(item: QuotationItem) {
  return materialCost(item) + (item.labor_cost || 0);
}

function printTotal(pj: PrintJob) {
  return (
    (pj.ink_cost || 0) +
    (pj.paper_cost || 0) +
    (pj.yard_price || 0) * (pj.yards_qty || 0) +
    (pj.design_qty || 0) * (pj.design_unit_price || 0)
  );
}

export function generatePDF(quotation: Quotation) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(26, 58, 92);
  doc.text("Brand It", 14, 22);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(150, 150, 150);
  doc.text("by Confecciones Boston", 14, 28);

  // Cotización info
  doc.setFontSize(11);
  doc.setTextColor(26, 58, 92);
  doc.text(`Cotización #${quotation.id}`, pageWidth - 14, 18, { align: "right" });
  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.text(`Fecha: ${formatDate(quotation.date)}`, pageWidth - 14, 24, { align: "right" });

  // Line
  doc.setDrawColor(230, 230, 230);
  doc.setLineWidth(0.5);
  doc.line(14, 33, pageWidth - 14, 33);

  // Client info
  let y = 40;
  if (quotation.client) {
    doc.setFontSize(10);
    doc.setTextColor(26, 58, 92);
    doc.setFont("helvetica", "bold");
    doc.text("Cliente:", 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(quotation.client.name, 38, y);
    if (quotation.client.phone) { y += 5; doc.text(`Tel: ${quotation.client.phone}`, 38, y); }
    if (quotation.client.email) { y += 5; doc.text(`Email: ${quotation.client.email}`, 38, y); }
  }

  // Confection items
  y += 10;
  const items = quotation.items || [];
  if (items.length > 0) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(26, 58, 92);
    doc.text("Items de Confección", 14, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      head: [["#", "Prenda", "Talle", "Cant.", "Mat.", "M.O.", "Costo", "Precio", "Ganancia"]],
      body: items.map((item, i) => [
        i + 1,
        item.description || "",
        item.size_color || "",
        item.quantity,
        formatCurrency(materialCost(item)),
        formatCurrency(item.labor_cost || 0),
        formatCurrency(totalCost(item)),
        formatCurrency(item.sale_price || 0),
        formatCurrency((item.sale_price || 0) - totalCost(item)),
      ]),
      theme: "grid",
      headStyles: { fillColor: [26, 58, 92], fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 0: { cellWidth: 10 }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "right" }, 8: { halign: "right" } },
      margin: { left: 14, right: 14 },
    });

    y = ((doc as unknown as Record<string, Record<string, number>>).lastAutoTable?.finalY ?? y + 25) + 5;
  }

  // Print jobs
  const pjs = quotation.print_jobs || [];
  if (pjs.length > 0) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(26, 58, 92);
    doc.text("Trabajos de Impresión", 14, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      head: [["#", "Descripción", "Tinta", "Papel", "Yardas", "Diseño", "Total"]],
      body: pjs.map((pj, i) => [
        i + 1,
        pj.description || "",
        formatCurrency(pj.ink_cost || 0),
        formatCurrency(pj.paper_cost || 0),
        formatCurrency((pj.yard_price || 0) * (pj.yards_qty || 0)),
        formatCurrency((pj.design_qty || 0) * (pj.design_unit_price || 0)),
        formatCurrency(printTotal(pj)),
      ]),
      theme: "grid",
      headStyles: { fillColor: [26, 58, 92], fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 0: { cellWidth: 10 }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" } },
      margin: { left: 14, right: 14 },
    });

    y = ((doc as unknown as Record<string, Record<string, number>>).lastAutoTable?.finalY ?? y + 25) + 5;
  }

  // Grand total
  const itemsTotal = items.reduce((sum, i) => sum + totalCost(i), 0);
  const printTotal_ = pjs.reduce((sum, p) => sum + printTotal(p), 0);
  const grandTotal = itemsTotal + printTotal_;
  const salesTotal = items.reduce((sum, i) => sum + (i.sale_price || 0), 0) + printTotal_;

  y += 5;
  doc.setDrawColor(230, 230, 230);
  doc.line(pageWidth - 80, y, pageWidth - 14, y);
  y += 7;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(26, 58, 92);
  doc.text("Costo Total:", pageWidth - 80, y);
  doc.text(formatCurrency(grandTotal), pageWidth - 14, y, { align: "right" });
  y += 6;
  doc.text("Total a Cobrar:", pageWidth - 80, y);
  doc.setTextColor(46, 204, 113);
  doc.text(formatCurrency(salesTotal), pageWidth - 14, y, { align: "right" });

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(200, 200, 200);
  doc.text("Brand It by Confecciones Boston", pageWidth / 2, pageHeight - 10, { align: "center" });

  doc.save(`Cotizacion_${quotation.id}_${quotation.client?.name || "sin_cliente"}.pdf`);
}
