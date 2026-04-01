import { getSupabaseAF } from "@/lib/supabase-af";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const COMPANY_KEY = "confecciones_boston";

export async function GET(request: NextRequest) {
  const db = getSupabaseAF();
  const uploadId = request.nextUrl.searchParams.get("upload_id");

  let latestUpload;

  if (uploadId) {
    // Load specific upload
    const { data } = await db
      .from("cxc_uploads")
      .select("id, uploaded_at, filename")
      .eq("id", uploadId)
      .single();
    latestUpload = data;
  } else {
    // Get latest upload
    const { data: uploads } = await db
      .from("cxc_uploads")
      .select("id, uploaded_at, filename")
      .eq("company_key", COMPANY_KEY)
      .order("uploaded_at", { ascending: false })
      .limit(1);
    latestUpload = uploads && uploads.length > 0 ? uploads[0] : null;
  }

  if (!latestUpload) {
    return NextResponse.json({ rows: [], upload: null });
  }

  // Get rows for the upload
  const { data: rows, error } = await db
    .from("cxc_rows")
    .select("*")
    .eq("upload_id", latestUpload.id)
    .order("nombre", { ascending: true });

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
  });
}
