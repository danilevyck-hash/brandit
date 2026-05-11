// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ventas/upload — Brand It
//
// Parser propio para listacomprobantes_boston.csv (Switch ERP) que ingiere
// SOLO los tipos COTIZACION y PEDIDO a ventas_pipeline_boston. Las facturas
// y notas las maneja el parser de fashiongr (van a ventas_raw, schema
// shared). Brand It NO debe duplicar esos comprobantes.
//
// Flujo:
//   1. Auth admin only
//   2. Multipart upload del CSV
//   3. Decode latin1 con fallback UTF-8
//   4. Parse CSV ;-delimitado
//   5. Filtrar TIPO IN ('COTIZACION', 'PEDIDO') — descartar el resto
//   6. Match cliente_codigo → cliente_id contra clientes_master
//   7. DELETE rows viejas de Boston en ventas_pipeline_boston
//      (mismo patrón que el upload de fashiongr: una sola "foto" vigente)
//   8. INSERT en batches de 2000
//
// Migration requerida: 20260511000000_ventas_pipeline_boston.sql aplicada.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { requireRoles, getSessionPayload } from "@/lib/auth-brandit";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const COMPANY_KEY = "confecciones_boston";

// Tipos que SÍ se ingieren a ventas_pipeline_boston. CSV viene en mayúsculas
// sin diacríticos (formato listacomprobantes nuevo). Mapeo a los valores
// canónicos del CHECK constraint de la tabla.
const TIPO_MAP: Record<string, "Cotizacion" | "Pedido"> = {
  COTIZACION:  "Cotizacion",
  COTIZACIÓN:  "Cotizacion",
  PEDIDO:      "Pedido",
};
// Tipos que el parser de fashiongr maneja en ventas_raw — los descartamos
// aquí silenciosamente para no duplicar data.
const PASSTHROUGH_TIPOS = new Set(["FACTURA", "TRANSACCION", "TRANSACCIÓN", "TIQUETE", "NOTA DE CREDITO", "NOTA DE CRÉDITO", "NOTA DE DEBITO", "NOTA DE DÉBITO"]);

interface RawRow {
  empresa: string;
  tipo: "Cotizacion" | "Pedido";
  fecha: string;
  anio: number;
  mes: number;
  quarter: number;
  n_sistema: string | null;
  n_fiscal: string | null;
  vendedor: string | null;
  cliente: string | null;
  cliente_id: string | null;
  cliente_codigo: string | null;
  subtotal: number;
  total: number;
  uploaded_by: string | null;
}

interface ParseStats {
  cotizaciones: number;
  pedidos: number;
  passthrough: number;   // facturas + notas + tiquetes (los maneja fashiongr)
  invalidTipo: number;
  invalidFecha: number;
  invalidCliente: number;
}

const REQUIRED_HEADERS = ["FECHA", "TIPO", "CLIENTE", "SUBTOTAL", "TOTAL"];

function parseFecha(raw: string): { iso: string; anio: number; mes: number; quarter: number } | null {
  // "DD-MM-YYYY" o "DD-MM-YYYY HH:MM:SS"
  const s = (raw ?? "").trim();
  if (!s) return null;
  const m = s.match(/^(\d{2})-(\d{2})-(\d{4})/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const anio = parseInt(yyyy, 10);
  const mes  = parseInt(mm, 10);
  if (mes < 1 || mes > 12) return null;
  return {
    iso: `${yyyy}-${mm}-${dd}`,
    anio,
    mes,
    quarter: Math.ceil(mes / 3),
  };
}

function toNum(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return isNaN(v) ? 0 : v;
  const s = String(v).trim().replace(/,/g, "");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function cleanText(s: string | null | undefined): string {
  return (s ?? "").trim().replace(/\s+/g, " ");
}

function normalizeTipo(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toUpperCase();
}

export async function POST(req: NextRequest) {
  const auth = requireRoles(req, ["admin"]);
  if (auth instanceof NextResponse) return auth;
  const session = getSessionPayload(req);

  // Apps Familia exclusivo: ventas_pipeline_boston, clientes_master, todo
  // en el mismo proyecto. Cero cross-project.
  const db = getSupabaseServer();

  // ── 1. Read multipart ────────────────────────────────────────────────────
  let file: File | null = null;
  let filename = "";
  try {
    const form = await req.formData();
    file = form.get("file") as File | null;
    filename = file?.name ?? "";
  } catch {
    return NextResponse.json({ error: "No se pudo leer el formulario" }, { status: 400 });
  }
  if (!file) return NextResponse.json({ error: "file requerido" }, { status: 400 });
  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: "Archivo demasiado grande (máx 20MB)" }, { status: 400 });
  }

  // ── 2. Decode (latin1 con fallback UTF-8) ────────────────────────────────
  const buffer = await file.arrayBuffer();
  let text = new TextDecoder("latin1").decode(buffer);
  const utf8Try = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  if (!utf8Try.includes("�") && /[áéíóúñÑÁÉÍÓÚ]/.test(utf8Try) && !/[áéíóúñÑÁÉÍÓÚ]/.test(text)) {
    text = utf8Try;
  }

  // ── 3. Parse CSV ─────────────────────────────────────────────────────────
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) {
    return NextResponse.json({ error: "El archivo está vacío o no tiene filas." }, { status: 400 });
  }

  const headers = lines[0].split(";").map(h => h.trim().replace(/\s+/g, " ").toUpperCase());
  const idx = (key: string): number => {
    const i = headers.indexOf(key);
    if (i >= 0) return i;
    if (key === "N.SISTEMA")  return headers.indexOf("N.INTERNO");
    if (key === "N. SISTEMA") return headers.indexOf("N. INTERNO");
    return -1;
  };

  const missing = REQUIRED_HEADERS.filter(h => idx(h) < 0);
  if (missing.length > 0) {
    return NextResponse.json({
      error: `El archivo no tiene los encabezados requeridos. Faltan: ${missing.join(", ")}. ` +
             `Verifica que descargaste el reporte 'listacomprobantes' de Switch.`,
    }, { status: 400 });
  }

  const iFecha     = idx("FECHA");
  const iTipo      = idx("TIPO");
  const iNInt      = idx("N.INTERNO") >= 0 ? idx("N.INTERNO") : idx("N. INTERNO");
  const iNFis      = idx("N.FISCAL")  >= 0 ? idx("N.FISCAL")  : idx("N. FISCAL");
  const iVendedor  = idx("VENDEDOR");
  const iCliente   = idx("CLIENTE");
  const iCodigo    = idx("CODIGO");
  const iSubtotal  = idx("SUBTOTAL");
  const iTotal     = idx("TOTAL");

  // ── 4. Match cliente_id por codigo (cargar map upfront) ─────────────────
  const codigoToId = new Map<string, string>();
  {
    const { data: clientes, error: cErr } = await db
      .from("clientes_master")
      .select("id, codigo")
      .eq("deleted", false);
    if (cErr) {
      console.error("[ventas/upload] error cargando clientes_master:", cErr.message);
      return NextResponse.json({ error: `No se pudo cargar clientes_master: ${cErr.message}` }, { status: 500 });
    }
    for (const c of clientes ?? []) if (c.codigo) codigoToId.set(c.codigo, c.id);
  }

  const stats: ParseStats = {
    cotizaciones: 0, pedidos: 0, passthrough: 0, invalidTipo: 0, invalidFecha: 0, invalidCliente: 0,
  };
  const rows: RawRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(";");
    const get = (j: number) => (j >= 0 ? cols[j]?.trim() ?? "" : "");

    const tipoRaw = normalizeTipo(get(iTipo));
    if (PASSTHROUGH_TIPOS.has(tipoRaw)) { stats.passthrough++; continue; }
    const tipoCanonical = TIPO_MAP[tipoRaw];
    if (!tipoCanonical) { stats.invalidTipo++; continue; }

    const fechaParsed = parseFecha(get(iFecha));
    if (!fechaParsed) { stats.invalidFecha++; continue; }

    const cliente = cleanText(get(iCliente));
    if (!cliente) { stats.invalidCliente++; continue; }

    const codigo = get(iCodigo) || null;
    rows.push({
      empresa: COMPANY_KEY,
      tipo: tipoCanonical,
      fecha: fechaParsed.iso,
      anio: fechaParsed.anio,
      mes:  fechaParsed.mes,
      quarter: fechaParsed.quarter,
      n_sistema: cleanText(iNInt >= 0 ? get(iNInt) : "") || null,
      n_fiscal:  cleanText(iNFis >= 0 ? get(iNFis) : "") || null,
      vendedor:  cleanText(get(iVendedor)) || null,
      cliente,
      cliente_codigo: codigo,
      cliente_id: codigo ? codigoToId.get(codigo) ?? null : null,
      subtotal: toNum(get(iSubtotal)),
      total:    toNum(get(iTotal)),
      uploaded_by: session?.userId ?? null,
    });

    if (tipoCanonical === "Cotizacion") stats.cotizaciones++;
    else stats.pedidos++;
  }

  if (rows.length === 0) {
    return NextResponse.json({
      error: "No se encontraron cotizaciones ni pedidos en el archivo. " +
             "Verifica que el reporte tenga filas con TIPO = COTIZACION o PEDIDO.",
      stats,
    }, { status: 400 });
  }

  // ── 5. DELETE rows viejas de Boston + INSERT en batches ──────────────────
  // Una sola foto vigente — el upload reemplaza lo anterior.
  const { error: delErr } = await db
    .from("ventas_pipeline_boston")
    .delete()
    .eq("empresa", COMPANY_KEY);
  if (delErr) {
    console.error("[ventas/upload] delete viejo falló:", delErr);
    return NextResponse.json({ error: `No se pudo limpiar el pipeline previo: ${delErr.message}` }, { status: 500 });
  }

  const BATCH = 2000;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const { error: insErr } = await db.from("ventas_pipeline_boston").insert(slice);
    if (insErr) {
      console.error("[ventas/upload] insert batch falló:", insErr);
      return NextResponse.json({
        error: `Error al insertar batch [${i}..${i + slice.length}): ${insErr.message}`,
        inserted_before_error: inserted,
        stats,
      }, { status: 500 });
    }
    inserted += slice.length;
  }

  const usuario = session?.nombre ?? session?.role ?? "unknown";
  await logActivity(
    usuario,
    "ventas_pipeline_upload",
    `Boston · ${stats.cotizaciones} cotizaciones + ${stats.pedidos} pedidos (${filename}). ` +
    `Passthrough (manejado por fashiongr): ${stats.passthrough}.`
  );

  return NextResponse.json({
    ok: true,
    inserted,
    stats,
    filename,
  });
}
