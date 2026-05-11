// ─────────────────────────────────────────────────────────────────────────────
// GET /api/cxc
//
// Lee de cxc_aging (VIEW) — computa buckets d0_30..mas_365 + total a partir
// de cxc_rows per-factura (Fase 4 schema fashiongr). Reemplaza la lectura
// directa de cxc_rows (que esperaba columnas pre-agregadas d_0_30 etc.,
// formato viejo de antigüedad).
//
// Merge con cxc_client_overrides por nombre_normalized (esa tabla NO tiene
// company_key — sólo por nombre).
// ─────────────────────────────────────────────────────────────────────────────

import { getSupabaseServer } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { requireRoles } from "@/lib/auth-brandit";

export const dynamic = "force-dynamic";

const COMPANY_KEY = "confecciones_boston";

export async function GET(req: NextRequest) {
  const auth = requireRoles(req, ["admin", "secretaria", "vendedora1", "vendedora2"]);
  if (auth instanceof NextResponse) return auth;

  const db = getSupabaseServer();
  const uploadId = req.nextUrl.searchParams.get("upload_id");

  // ── Determinar el upload activo ──────────────────────────────────────────
  let latestUpload;
  if (uploadId) {
    const { data, error: upErr } = await db
      .from("cxc_uploads")
      .select("id, uploaded_at, filename")
      .eq("id", uploadId)
      .single();
    if (upErr) {
      console.error("[api/cxc] error cargando upload por id:", upErr);
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }
    latestUpload = data;
  } else {
    const { data: uploads, error: upErr } = await db
      .from("cxc_uploads")
      .select("id, uploaded_at, filename")
      .eq("company_key", COMPANY_KEY)
      .order("uploaded_at", { ascending: false })
      .limit(1);
    if (upErr) {
      console.error("[api/cxc] error cargando cxc_uploads:", upErr);
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }
    latestUpload = uploads && uploads.length > 0 ? uploads[0] : null;
  }

  if (!latestUpload) {
    return NextResponse.json({ rows: [], upload: null });
  }

  // ── Leer cxc_aging (buckets computados) ──────────────────────────────────
  // Filtramos por upload_id para que coincida con el upload activo. La VIEW
  // ya filtra `HAVING ABS(total) >= 0.01` para sacar el ruido de redondeo.
  const { data: rows, error } = await db
    .from("cxc_aging")
    .select("*")
    .eq("upload_id", latestUpload.id)
    .eq("company_key", COMPANY_KEY)
    .order("nombre", { ascending: true });

  if (error) {
    console.error("[api/cxc] error leyendo cxc_aging:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // ── Merge con overrides por nombre_normalized ─────────────────────────────
  // cxc_client_overrides NO tiene company_key — se aplica cross-empresa.
  // Schema actual: { nombre_normalized, correo, telefono, celular, contacto,
  //                  resultado_contacto, proximo_seguimiento, updated_at }
  const { data: overrides } = await db
    .from("cxc_client_overrides")
    .select("*");

  type OverrideRow = {
    nombre_normalized: string;
    correo?: string | null;
    telefono?: string | null;
    celular?: string | null;
    contacto?: string | null;
    resultado_contacto?: string | null;
    proximo_seguimiento?: string | null;
  };

  const overrideMap = new Map<string, OverrideRow>(
    (overrides ?? []).map((o: OverrideRow) => [o.nombre_normalized, o])
  );

  const mergedRows = (rows ?? []).map(row => {
    const override = overrideMap.get(row.nombre_normalized);
    return {
      ...row,
      override_resultado: override?.resultado_contacto ?? null,
      override_seguimiento: override?.proximo_seguimiento ?? null,
    };
  });

  return NextResponse.json({
    rows: mergedRows,
    upload: latestUpload,
  });
}
