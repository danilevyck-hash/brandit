import { getSupabaseAF } from "@/lib/supabase-af";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const COMPANY_KEY = "confecciones_boston";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { rows, filename } = body;

  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "No se encontraron datos válidos en el CSV" }, { status: 400 });
  }

  const db = getSupabaseAF();

  // Create upload record
  const { data: upload, error: uploadError } = await db
    .from("cxc_uploads")
    .insert([{ company_key: COMPANY_KEY, filename: filename || "upload.csv" }])
    .select()
    .single();

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  // Delete previous rows (keep only latest upload)
  await db
    .from("cxc_rows")
    .delete()
    .eq("company_key", COMPANY_KEY)
    .neq("upload_id", upload.id);

  // Insert new rows
  const dbRows = rows.map((row: Record<string, unknown>) => ({
    upload_id: upload.id,
    company_key: COMPANY_KEY,
    codigo: row.codigo || null,
    nombre: row.nombre || "",
    nombre_normalized: row.nombre_normalized || "",
    correo: row.correo || null,
    telefono: row.telefono || null,
    celular: row.celular || null,
    contacto: row.contacto || null,
    pais: row.pais || null,
    provincia: row.provincia || null,
    distrito: row.distrito || null,
    corregimiento: row.corregimiento || null,
    limite_credito: row.limite_credito || 0,
    limite_morosidad: row.limite_morosidad || 0,
    d_0_30: row.d_0_30 || 0,
    d_31_60: row.d_31_60 || 0,
    d_61_90: row.d_61_90 || 0,
    d_91_120: row.d_91_120 || 0,
    d_121_180: row.d_121_180 || 0,
    d_181_270: row.d_181_270 || 0,
    d_271_365: row.d_271_365 || 0,
    d_mas_365: row.d_mas_365 || 0,
    total: row.total || 0,
  }));

  // Insert in batches of 100
  for (let i = 0; i < dbRows.length; i += 100) {
    const batch = dbRows.slice(i, i + 100);
    const { error: insertError } = await db.from("cxc_rows").insert(batch);
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true, count: dbRows.length, upload_id: upload.id });
}
