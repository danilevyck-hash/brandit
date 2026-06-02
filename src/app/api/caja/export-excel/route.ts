import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { requireRoles, type Role } from "@/lib/auth-brandit";
import ExcelJS from "exceljs";

const CAJA_ROLES: readonly Role[] = ["admin", "secretaria"];

export const dynamic = "force-dynamic";

const MONEY_FMT = '"$"#,##0.00';

function fmtDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

export async function POST(req: NextRequest) {
  const auth = requireRoles(req, CAJA_ROLES);
  if (auth instanceof NextResponse) return auth;
  try {
    const { periodo_id } = await req.json();
    if (!periodo_id) return NextResponse.json({ error: "No periodo_id" }, { status: 400 });

    const { data: periodo, error: pErr } = await getSupabaseServer().from("caja_periodos").select("*").eq("id", periodo_id).single();
    if (pErr || !periodo) return NextResponse.json({ error: "Período no encontrado" }, { status: 404 });
    const { data: gastos } = await getSupabaseServer().from("caja_gastos").select("*").eq("periodo_id", periodo_id).eq("deleted", false).order("fecha", { ascending: true });

    const fondo = periodo?.fondo_inicial || 200;

    const wb = new ExcelJS.Workbook();

    // ── Sheet 1 — Gastos ──
    const ws = wb.addWorksheet("Gastos");
    ws.getColumn(1).width = 11;
    ws.getColumn(2).width = 26;
    ws.getColumn(3).width = 16;
    ws.getColumn(4).width = 14;
    ws.getColumn(5).width = 14;
    ws.getColumn(6).width = 14;
    ws.getColumn(7).width = 11;
    ws.getColumn(8).width = 9;
    ws.getColumn(9).width = 11;

    let r = 1;

    // Title
    ws.mergeCells(r, 1, r, 9);
    const titleCell = ws.getCell(r, 1);
    titleCell.value = "Confecciones Boston — Caja Menuda";
    titleCell.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF000000" } };
    titleCell.alignment = { horizontal: "left", vertical: "middle" };
    ws.getRow(r).height = 30;
    r++;

    // Subtitle
    ws.mergeCells(r, 1, r, 9);
    const subCell = ws.getCell(r, 1);
    subCell.value = `Período N° ${periodo?.numero || ""}  ·  Apertura: ${fmtDate(periodo?.fecha_apertura || "")}`;
    subCell.font = { italic: true, size: 10, color: { argb: "FFAAAAAA" } };
    subCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A1A1A" } };
    subCell.alignment = { horizontal: "left", vertical: "middle" };
    ws.getRow(r).height = 18;
    r++;

    // Fondo info
    const fLbl = ws.getCell(r, 1);
    fLbl.value = "Fondo inicial:";
    fLbl.font = { size: 9, color: { argb: "FF888888" } };
    const fVal = ws.getCell(r, 2);
    fVal.value = fondo;
    fVal.numFmt = MONEY_FMT;
    fVal.font = { bold: true, size: 10 };
    ws.getRow(r).height = 18;
    r++;

    // Spacer
    ws.getRow(r).height = 6;
    r++;

    // Table header
    const cols = ["Fecha", "Descripción", "Proveedor", "Responsable", "Categoría", "N° Factura", "Sub-total", "ITBMS", "Total"];
    cols.forEach((h, i) => {
      const cell = ws.getCell(r, i + 1);
      cell.value = h;
      cell.font = { bold: true, size: 9, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF111111" } };
      cell.alignment = { horizontal: i >= 6 ? "right" : "left", vertical: "middle" };
    });
    ws.getRow(r).height = 20;
    r++;

    // Data rows
    let totalSub = 0, totalItbms = 0, totalTotal = 0;
    (gastos || []).forEach((g, i) => {
      const alt = i % 2 === 0;
      const bg = alt ? "FFFAFAFA" : "FFFFFFFF";
      const setText = (c: number, v: string, fg: string) => {
        const cell = ws.getCell(r, c);
        cell.value = v;
        cell.font = { size: 10, color: { argb: fg } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        cell.alignment = { horizontal: "left" };
      };
      const setNum = (c: number, v: number, fg: string, bold: boolean) => {
        const cell = ws.getCell(r, c);
        cell.value = v;
        cell.numFmt = MONEY_FMT;
        cell.font = { size: 10, bold, color: { argb: fg } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        cell.alignment = { horizontal: "right" };
      };
      setText(1, fmtDate(g.fecha), "FF555555");
      setText(2, g.descripcion || g.nombre || "", "FF111111");
      setText(3, g.proveedor || "", "FF666666");
      setText(4, g.responsable || "", "FF444444");
      setText(5, g.categoria || "Varios", "FF555555");
      setText(6, g.nro_factura || "", "FF999999");
      setNum(7, g.subtotal || 0, "FF333333", false);
      setNum(8, g.itbms || 0, "FF888888", false);
      setNum(9, g.total || 0, "FF333333", true);
      totalSub += g.subtotal || 0; totalItbms += g.itbms || 0; totalTotal += g.total || 0;
      ws.getRow(r).height = 18;
      r++;
    });

    // Spacer
    ws.getRow(r).height = 6;
    r++;

    // Totals row
    const totLbl = ws.getCell(r, 6);
    totLbl.value = "TOTALES";
    totLbl.font = { bold: true, size: 9 };
    totLbl.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F0F0" } };
    totLbl.alignment = { horizontal: "right" };
    const setTotNum = (c: number, v: number) => {
      const cell = ws.getCell(r, c);
      cell.value = v;
      cell.numFmt = MONEY_FMT;
      cell.font = { bold: true, size: 10 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F0F0" } };
      cell.alignment = { horizontal: "right" };
    };
    setTotNum(7, totalSub);
    setTotNum(8, totalItbms);
    setTotNum(9, totalTotal);
    ws.getRow(r).height = 20;
    r++;

    // Summary
    r++;
    const saldo = fondo - totalTotal;
    const saldoColor = saldo > 0 ? { bg: "FFF0FDF4", fg: "FF15803D" } : { bg: "FFFEF2F2", fg: "FFDC2626" };

    const sumLbl = (c: number, v: string) => {
      const cell = ws.getCell(r, c);
      cell.value = v;
      cell.font = { size: 9, color: { argb: "FF888888" } };
      cell.alignment = { horizontal: "right" };
    };
    const sumNum = (c: number, v: number, fg?: string) => {
      const cell = ws.getCell(r, c);
      cell.value = v;
      cell.numFmt = MONEY_FMT;
      cell.font = fg ? { size: 10, color: { argb: fg } } : { size: 10 };
      cell.alignment = { horizontal: "right" };
    };

    sumLbl(7, "Fondo inicial:"); sumNum(9, fondo); ws.getRow(r).height = 18; r++;
    sumLbl(7, "Total gastado:"); sumNum(9, totalTotal, totalTotal > fondo * 0.8 ? "FFDC2626" : undefined); ws.getRow(r).height = 18; r++;
    const saldoLbl = ws.getCell(r, 7);
    saldoLbl.value = "Saldo disponible:";
    saldoLbl.font = { bold: true, size: 10 };
    saldoLbl.alignment = { horizontal: "right" };
    const saldoValCell = ws.getCell(r, 9);
    saldoValCell.value = saldo;
    saldoValCell.numFmt = MONEY_FMT;
    saldoValCell.font = { bold: true, size: 11, color: { argb: saldoColor.fg } };
    saldoValCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: saldoColor.bg } };
    saldoValCell.alignment = { horizontal: "right" };
    ws.getRow(r).height = 20;
    r++;

    // ── Sheet 2 — Por Categoría ──
    const ws2 = wb.addWorksheet("Por Categoría");
    ws2.getColumn(1).width = 22;
    ws2.getColumn(2).width = 14;
    ws2.getColumn(3).width = 12;

    const byCategory: Record<string, number> = {};
    for (const g of gastos || []) { const cat = g.categoria || "Varios"; byCategory[cat] = (byCategory[cat] || 0) + (g.total || 0); }
    const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);

    let r2 = 1;

    // Title
    ws2.mergeCells(r2, 1, r2, 3);
    const t2 = ws2.getCell(r2, 1);
    t2.value = "Resumen por Categoría";
    t2.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
    t2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF000000" } };
    t2.alignment = { horizontal: "left", vertical: "middle" };
    ws2.getRow(r2).height = 26;
    r2++;

    // Spacer
    ws2.getRow(r2).height = 6;
    r2++;

    // Header
    const h2 = [
      { c: 1, v: "Categoría", right: false },
      { c: 2, v: "Total", right: true },
      { c: 3, v: "% del total", right: true },
    ];
    h2.forEach(({ c, v, right }) => {
      const cell = ws2.getCell(r2, c);
      cell.value = v;
      cell.font = { bold: true, size: 9, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF111111" } };
      cell.alignment = { horizontal: right ? "right" : "left", vertical: "middle" };
    });
    ws2.getRow(r2).height = 20;
    r2++;

    sorted.forEach(([cat, total], i) => {
      const alt = i % 2 === 0;
      const isTop = i === 0;
      const bg = isTop ? "FFFFF3CD" : alt ? "FFFAFAFA" : "FFFFFFFF";
      const cCat = ws2.getCell(r2, 1);
      cCat.value = cat;
      cCat.font = { size: 10 };
      cCat.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cCat.alignment = { horizontal: "left" };
      const cTot = ws2.getCell(r2, 2);
      cTot.value = total;
      cTot.numFmt = MONEY_FMT;
      cTot.font = { bold: true, size: 10 };
      cTot.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cTot.alignment = { horizontal: "right" };
      const cPct = ws2.getCell(r2, 3);
      cPct.value = totalTotal > 0 ? total / totalTotal : 0;
      cPct.numFmt = "0.0%";
      cPct.font = { size: 9, color: { argb: "FF888888" } };
      cPct.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cPct.alignment = { horizontal: "right" };
      ws2.getRow(r2).height = 18;
      r2++;
    });

    // Category total
    const tcCat = ws2.getCell(r2, 1);
    tcCat.value = "TOTAL";
    tcCat.font = { bold: true, size: 10 };
    tcCat.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F0F0" } };
    const tcTot = ws2.getCell(r2, 2);
    tcTot.value = totalTotal;
    tcTot.numFmt = MONEY_FMT;
    tcTot.font = { bold: true, size: 10 };
    tcTot.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F0F0" } };
    tcTot.alignment = { horizontal: "right" };
    const tcPct = ws2.getCell(r2, 3);
    tcPct.value = 1;
    tcPct.numFmt = "0%";
    tcPct.font = { bold: true, size: 9 };
    tcPct.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F0F0" } };
    tcPct.alignment = { horizontal: "right" };
    ws2.getRow(r2).height = 20;
    r2++;

    const buf = await wb.xlsx.writeBuffer();

    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="CajaMenuda-Periodo${periodo?.numero || ""}.xlsx"`,
      },
    });
  } catch (err) {
    console.error("[caja/export-excel] Error:", err);
    return NextResponse.json({ error: "Error al generar el Excel. Intenta de nuevo." }, { status: 500 });
  }
}
