import { getSupabaseAF } from "@/lib/supabase-af";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const COMPANY_KEY = "confecciones_boston";

export async function GET() {
  const db = getSupabaseAF();

  // Get latest upload
  const { data: uploads } = await db
    .from("cxc_uploads")
    .select("id, uploaded_at, filename")
    .eq("company_key", COMPANY_KEY)
    .order("uploaded_at", { ascending: false })
    .limit(1);

  const latestUpload = uploads && uploads.length > 0 ? uploads[0] : null;

  if (!latestUpload) {
    return NextResponse.json({ rows: [], upload: null });
  }

  // Get rows for the latest upload
  const { data: rows, error } = await db
    .from("cxc_rows")
    .select("*")
    .eq("upload_id", latestUpload.id)
    .order("nombre", { ascending: true });

  console.log("[CXC GET] upload_id:", latestUpload?.id, "rows_count:", rows?.length, "error:", error?.message, "SUPABASE_URL:", process.env.APPS_FAMILIA_SUPABASE_URL?.slice(0, 30));

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get client overrides
  const { data: overrides } = await db
    .from("cxc_client_overrides")
    .select("*")
    .eq("company_key", COMPANY_KEY);

  const overrideMap = new Map(
    (overrides || []).map((o) => [o.nombre_normalized, o])
  );

  // Merge overrides into rows
  const mergedRows = (rows || []).map((row) => {
    const override = overrideMap.get(row.nombre_normalized);
    return {
      ...row,
      override_notas: override?.notas || null,
      override_estado: override?.estado || null,
    };
  });

  return NextResponse.json({
    rows: mergedRows,
    upload: latestUpload,
    _debug: { rows_count: rows?.length, upload_id: latestUpload?.id },
  });
}
