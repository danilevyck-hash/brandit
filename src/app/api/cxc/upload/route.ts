// ─────────────────────────────────────────────────────────────────────────────
// POST /api/cxc/upload
//
// Parser de "detallessaldos_*.csv" (Switch ERP, formato per-document)
// portado de fashiongr. Reemplaza el parser viejo de antigüedad que
// quedó incompatible con el schema actual de cxc_rows (per-factura desde
// Fase 4 de fashiongr).
//
// Flujo:
//   1. Auth (admin, secretaria, vendedora1, vendedora2)
//   2. Multipart form: file (CSV) — company_key hardcoded a Boston
//   3. Decode latin1 con fallback UTF-8
//   4. Parse CSV ;-delimitado, headers: FECHA, CODIGO, COMPROBANTE,
//      DEBITOS, CREDITOS, SALDO, N. SISTEMA/INTERNO, N. FISCAL, VENCE, DIAS
//   5. Filtrar filas sin CODIGO o sin COMPROBANTE
//   6. Match cliente_id contra clientes_master.codigo
//   7. DELETE upload viejo de Boston (CASCADE limpia cxc_rows)
//   8. INSERT cxc_uploads header + cxc_rows en batches de 2000
//   9. Stats para validar contra el reporte Switch
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { requireRoles, getSessionPayload } from "@/lib/auth-brandit";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const COMPANY_KEY = "confecciones_boston";

interface RawRow {
  upload_id: string;
  company_key: string;
  cliente_codigo: string;
  cliente_id: string | null;
  fecha: string | null;
  comprobante: string;
  n_sistema: string;
  n_fiscal: string;
  debito: number;
  credito: number;
  saldo: number;
  fecha_vencimiento: string | null;
  dias_vencidos: number | null;
}

interface ParseResult {
  rows: Omit<RawRow, "upload_id" | "cliente_id" | "company_key">[];
  filtered: { sinCodigo: number; sinComprobante: number };
  warnings: string[];
}

const REQUIRED_HEADERS = ["FECHA", "CODIGO", "COMPROBANTE", "DEBITOS", "CREDITOS", "SALDO"];

function parseFechaDDMMYYYY(raw: string): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  const m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function toNum(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return isNaN(v) ? 0 : v;
  const s = String(v).trim().replace(/,/g, "");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function toIntOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}

function cleanText(s: string | null | undefined): string {
  return (s ?? "").trim().replace(/\s+/g, " ");
}

function parseCsv(text: string): ParseResult {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) throw new Error("El archivo está vacío o no tiene filas.");

  const rawHeaders = lines[0].split(";").map(h => h.trim().replace(/\s+/g, " ").toUpperCase());
  const idx = (key: string): number => {
    const i = rawHeaders.indexOf(key);
    if (i >= 0) return i;
    if (key === "N. SISTEMA") return rawHeaders.indexOf("N. INTERNO");
    return -1;
  };

  const missing = REQUIRED_HEADERS.filter(h => idx(h) < 0);
  if (missing.length > 0) {
    throw new Error(
      `El archivo no tiene los encabezados requeridos. Faltan: ${missing.join(", ")}. ` +
      `Asegurate de descargar 'Detalle de saldos' (no 'Antigüedad') desde Switch.`
    );
  }

  const iFecha       = idx("FECHA");
  const iCodigo      = idx("CODIGO");
  const iComprobante = idx("COMPROBANTE");
  const iNSistema    = idx("N. SISTEMA");
  const iNFiscal     = idx("N. FISCAL");
  const iDebitos     = idx("DEBITOS");
  const iCreditos    = idx("CREDITOS");
  const iSaldo       = idx("SALDO");
  const iVence       = idx("VENCE");
  const iDias        = idx("DIAS");

  const rows: ParseResult["rows"] = [];
  const filtered = { sinCodigo: 0, sinComprobante: 0 };

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(";");
    const get = (j: number) => (j >= 0 ? cols[j]?.trim() ?? "" : "");

    const cliente_codigo = get(iCodigo);
    if (!cliente_codigo) { filtered.sinCodigo++; continue; }

    const comprobante = cleanText(get(iComprobante));
    if (!comprobante) { filtered.sinComprobante++; continue; }

    rows.push({
      cliente_codigo,
      fecha: parseFechaDDMMYYYY(get(iFecha)),
      comprobante,
      n_sistema: cleanText(get(iNSistema)),
      n_fiscal:  cleanText(get(iNFiscal)),
      debito:    toNum(get(iDebitos)),
      credito:   toNum(get(iCreditos)),
      saldo:     toNum(get(iSaldo)),
      fecha_vencimiento: parseFechaDDMMYYYY(get(iVence)),
      dias_vencidos: iDias >= 0 ? toIntOrNull(get(iDias)) : null,
    });
  }

  const warnings: string[] = [];
  if (rows.length === 0) warnings.push("No se encontraron filas válidas.");

  return { rows, filtered, warnings };
}

export async function POST(req: NextRequest) {
  const auth = requireRoles(req, ["admin"]);
  if (auth instanceof NextResponse) return auth;
  const session = getSessionPayload(req);

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

  // ── 2. Archive a Storage (no bloqueante, bucket compartido con fashiongr) ─
  try {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const time = now.toISOString().slice(11, 19).replace(/:/g, "-");
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const archivePath = `cxc-uploads/${COMPANY_KEY}/${today}_${time}_${safeName}`;
    const { error: archErr } = await db.storage.from("backups").upload(archivePath, file, { upsert: false });
    if (archErr) console.warn("[cxc/upload] archive failed (non-blocking):", archErr.message);
  } catch (archEx) {
    console.warn("[cxc/upload] archive exception (non-blocking):", archEx);
  }

  // ── 3. Decode (latin1 con fallback UTF-8) ────────────────────────────────
  const buffer = await file.arrayBuffer();
  let text = new TextDecoder("latin1").decode(buffer);
  const utf8Try = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  if (!utf8Try.includes("�") && /[áéíóúñÑÁÉÍÓÚ]/.test(utf8Try) && !/[áéíóúñÑÁÉÍÓÚ]/.test(text)) {
    text = utf8Try;
  }

  // ── 4. Parse ──────────────────────────────────────────────────────────────
  let parsed: ParseResult;
  try {
    parsed = parseCsv(text);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al parsear el archivo.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  if (parsed.rows.length === 0) {
    return NextResponse.json({ error: "No se encontraron filas válidas en el archivo." }, { status: 400 });
  }

  // ── 5. Match cliente_id por codigo ────────────────────────────────────────
  const codigoToId = new Map<string, string>();
  {
    const { data: clientes, error: cErr } = await db
      .from("clientes_master")
      .select("id, codigo")
      .eq("deleted", false);
    if (cErr) {
      console.error("[cxc/upload] error cargando clientes_master:", cErr.message);
      return NextResponse.json({ error: `No se pudo cargar clientes_master: ${cErr.message}` }, { status: 500 });
    }
    for (const c of clientes ?? []) if (c.codigo) codigoToId.set(c.codigo, c.id);
  }

  // ── 5.5. Auto-populate clientes_master placeholders (Fase D) ─────────────
  // UPSERT atómico con DO NOTHING (ignoreDuplicates:true) vía partial unique
  // index clientes_master_codigo_unique. CxC sólo trae CODIGO (sin nombre),
  // así que crea placeholders con nombre = codigo SOLO para códigos nuevos.
  // Si Ventas ya creó el cliente con nombre real, ON CONFLICT DO NOTHING
  // preserva ese nombre — el placeholder nunca pisa data buena.
  // .select() después de upsert con ignoreDuplicates:true devuelve sólo las
  // rows realmente insertadas (las omitidas no aparecen).
  const uniqueCodigosCsv = Array.from(new Set(parsed.rows.map(r => r.cliente_codigo)));
  let placeholdersCreados = 0;
  if (uniqueCodigosCsv.length > 0) {
    const payload = uniqueCodigosCsv.map(c => ({
      codigo: c,
      nombre: c,
      nombre_normalized: c.toLowerCase().trim(),
    }));
    const { data: inserted, error: upsertErr } = await db
      .from("clientes_master")
      .upsert(payload, { onConflict: "codigo", ignoreDuplicates: true })
      .select("id, codigo");
    if (upsertErr) {
      console.error("[cxc/upload] upsert placeholders falló:", upsertErr);
      return NextResponse.json({
        error: `No se pudieron sincronizar clientes: ${upsertErr.message}`,
      }, { status: 500 });
    }
    for (const c of inserted ?? []) if (c.codigo) codigoToId.set(c.codigo, c.id);
    placeholdersCreados = inserted?.length ?? 0;
  }

  let matched = 0;
  const unmatchedCodigos = new Map<string, number>();
  const codigoToClienteId = (codigo: string): string | null => {
    const id = codigoToId.get(codigo);
    if (id) { matched++; return id; }
    unmatchedCodigos.set(codigo, (unmatchedCodigos.get(codigo) ?? 0) + 1);
    return null;
  };

  // ── 6. DELETE upload viejo de Boston (CASCADE limpia cxc_rows) ───────────
  const { error: delErr } = await db
    .from("cxc_uploads")
    .delete()
    .eq("company_key", COMPANY_KEY);
  if (delErr) {
    console.error("[cxc/upload] delete viejo falló:", delErr);
    return NextResponse.json({ error: `No se pudo limpiar uploads previos: ${delErr.message}` }, { status: 500 });
  }

  const { data: uploadHeader, error: hdrErr } = await db
    .from("cxc_uploads")
    .insert({ company_key: COMPANY_KEY, filename, row_count: parsed.rows.length })
    .select("id")
    .single();
  if (hdrErr || !uploadHeader) {
    console.error("[cxc/upload] insert header falló:", hdrErr);
    return NextResponse.json({ error: `No se pudo crear el upload header: ${hdrErr?.message ?? "unknown"}` }, { status: 500 });
  }
  const uploadId = uploadHeader.id;

  const payload: RawRow[] = parsed.rows.map(r => ({
    upload_id: uploadId,
    company_key: COMPANY_KEY,
    cliente_codigo: r.cliente_codigo,
    cliente_id: codigoToClienteId(r.cliente_codigo),
    fecha: r.fecha,
    comprobante: r.comprobante,
    n_sistema: r.n_sistema,
    n_fiscal: r.n_fiscal,
    debito: r.debito,
    credito: r.credito,
    saldo: r.saldo,
    fecha_vencimiento: r.fecha_vencimiento,
    dias_vencidos: r.dias_vencidos,
  }));

  const BATCH = 2000;
  let inserted = 0;
  let totalNeto = 0;
  for (let i = 0; i < payload.length; i += BATCH) {
    const slice = payload.slice(i, i + BATCH);
    for (const r of slice) totalNeto += r.debito - r.credito;
    const { error: insErr } = await db.from("cxc_rows").insert(slice);
    if (insErr) {
      console.error("[cxc/upload] insert batch falló:", insErr);
      return NextResponse.json({
        error: `Error al insertar batch [${i}..${i + slice.length}): ${insErr.message}`,
        inserted_before_error: inserted,
      }, { status: 500 });
    }
    inserted += slice.length;
  }

  const unmatchedTop = Array.from(unmatchedCodigos.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([codigo, count]) => ({ codigo, count }));

  const usuario = session?.nombre ?? session?.role ?? "unknown";
  await logActivity(
    usuario,
    "cxc_upload",
    `Boston · ${inserted} filas · match ${matched}/${payload.length} · ` +
    `${placeholdersCreados} clientes nuevos (${filename})`
  );

  return NextResponse.json({
    ok: true,
    upload_id: uploadId,
    count: inserted,
    filtered: parsed.filtered,
    warnings: parsed.warnings,
    total_neto: Math.round(totalNeto * 100) / 100,
    matched,
    unmatched: payload.length - matched,
    pct_unmatched: payload.length > 0
      ? Math.round(((payload.length - matched) / payload.length) * 1000) / 10
      : 0,
    unmatched_codigos: unmatchedTop,
    placeholders_creados: placeholdersCreados,
  });
}
