import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAF } from "@/lib/supabase-af";

export const dynamic = "force-dynamic";

const TABLES = [
  "quotations",
  "quotation_items",
  "print_jobs",
  "clients",
  "leads",
  "lead_comentarios",
  "cxc_rows",
  "cxc_uploads",
  "guia_transporte",
  "caja_periodos",
  "caja_gastos",
  "user_roles",
  "notas_entrega",
  "notas_entrega_items",
  "admin_firmas",
  "activity_log",
] as const;

export async function GET(req: NextRequest) {
  const secret =
    req.headers.get("authorization")?.replace("Bearer ", "") ||
    req.nextUrl.searchParams.get("secret");

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAF();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const counts: Record<string, number> = {};
  const data: Record<string, unknown[]> = {};

  // Export all tables
  for (const table of TABLES) {
    const { data: rows, error } = await supabase.from(table).select("*");

    if (error) {
      console.error(`Error fetching ${table}:`, error.message);
      data[table] = [];
      counts[table] = 0;
    } else {
      data[table] = rows || [];
      counts[table] = rows?.length || 0;
    }
  }

  const backup = {
    meta: {
      project: "brandit",
      date: today,
      timestamp: now.toISOString(),
      counts,
    },
    ...data,
  };

  const jsonBytes = Buffer.from(JSON.stringify(backup), "utf-8");

  // Upload to Supabase Storage
  const { error: storageErr } = await supabase.storage
    .from("backups")
    .upload(`brandit-backup-${today}.json`, jsonBytes, {
      contentType: "application/json",
      upsert: true,
    });

  if (storageErr) {
    console.error("Storage upload error:", storageErr);
  }

  // Clean old backups (keep last 30 days)
  try {
    const { data: files } = await supabase.storage
      .from("backups")
      .list("", { limit: 200 });

    if (files && files.length > 30) {
      const sorted = files
        .filter((f) => f.name.startsWith("brandit-backup-"))
        .sort((a, b) => a.name.localeCompare(b.name));
      const toDelete = sorted.slice(0, sorted.length - 30).map((f) => f.name);
      if (toDelete.length > 0) {
        await supabase.storage.from("backups").remove(toDelete);
      }
    }
  } catch (e) {
    console.error("Cleanup error:", e);
  }

  return NextResponse.json({
    ok: true,
    date: today,
    counts,
    storage: !storageErr,
  });
}
