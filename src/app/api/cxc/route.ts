// ─────────────────────────────────────────────────────────────────────────────
// GET /api/cxc
//
// Lee de switch_estadocuenta (data validada del sync Switch, cuadrada al centavo
// contra el reporte oficial) en vez de cxc_aging/cxc_rows (upload manual viejo,
// que quedan como histórico congelado y NO se tocan).
//
// switch_estadocuenta es PER-DOCUMENTO y ya trae el `bucket` pre-calculado por
// syncEstadocuenta con la lógica validada:
//   - saldo = debito - credito
//   - clientes con saldo neto ~0 EXCLUIDOS (no están en la tabla)
//   - bucket por la fecha de CADA documento, corte estricto "<" (0-30..+365)
// Acá solo AGREGAMOS por cliente: SUM(saldo) por bucket → columnas d0_30..mas_365.
//
// Contacto (correo/telefono/celular/provincia): merge best-effort con
// clientes_master por nombre_normalized (misma fuente que la vista vieja).
// Resultado/seguimiento: merge con cxc_client_overrides por nombre_normalized.
// ─────────────────────────────────────────────────────────────────────────────

import { getSupabaseServer } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { requireRoles } from "@/lib/auth-brandit";

export const dynamic = "force-dynamic";

// bucket (como lo guarda switch_estadocuenta) → columna que espera la UI.
const BUCKET_FIELD: Record<string, string> = {
  "0-30": "d0_30",
  "31-60": "d31_60",
  "61-90": "d61_90",
  "91-120": "d91_120",
  "121-180": "d121_180",
  "181-270": "d181_270",
  "271-365": "d271_365",
  "+365": "mas_365",
};

// Normalización de nombre para cruzar con clientes_master / overrides / favoritos
// (mismo criterio que la vista cxc_aging: upper, sin [.,], espacios colapsados).
function normalizeNombre(n: string): string {
  return (n ?? "").toUpperCase().replace(/[.,]/g, "").replace(/\s+/g, " ").trim();
}

const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);

export async function GET(req: NextRequest) {
  const auth = requireRoles(req, ["admin"]);
  if (auth instanceof NextResponse) return auth;

  const db = getSupabaseServer();

  // ── 1) Leer switch_estadocuenta (per-documento, snapshot vigente) ──────────
  const { data: docs, error } = await db
    .from("switch_estadocuenta")
    .select("cliente_codigo, cliente_nombre, bucket, saldo, synced_at")
    .limit(20000);

  if (error) {
    console.error("[api/cxc] error leyendo switch_estadocuenta:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!docs || docs.length === 0) {
    return NextResponse.json({ rows: [], upload: null });
  }

  // ── 2) Agregar por cliente: SUM(saldo) por bucket + total ──────────────────
  type Agg = {
    id: string; codigo: string; nombre: string; nombre_normalized: string;
    d0_30: number; d31_60: number; d61_90: number; d91_120: number;
    d121_180: number; d181_270: number; d271_365: number; mas_365: number;
    total: number;
  };
  const agg = new Map<string, Agg>();
  let latestSynced = "";

  for (const d of docs as { cliente_codigo: string; cliente_nombre: string | null; bucket: string | null; saldo: number | string; synced_at: string }[]) {
    const codigo = d.cliente_codigo;
    const nombre = d.cliente_nombre ?? codigo;
    let e = agg.get(codigo);
    if (!e) {
      e = {
        id: codigo, codigo, nombre, nombre_normalized: normalizeNombre(nombre),
        d0_30: 0, d31_60: 0, d61_90: 0, d91_120: 0, d121_180: 0, d181_270: 0, d271_365: 0, mas_365: 0,
        total: 0,
      };
      agg.set(codigo, e);
    }
    const saldo = num(d.saldo);
    const field = d.bucket ? BUCKET_FIELD[d.bucket] : undefined;
    if (field) (e as unknown as Record<string, number>)[field] += saldo;
    e.total += saldo;
    if (d.synced_at && d.synced_at > latestSynced) latestSynced = d.synced_at;
  }

  // ── 3) Merge contacto (clientes_master) + overrides, por nombre_normalized ──
  const [{ data: master }, { data: overrides }] = await Promise.all([
    db.from("clientes_master").select("nombre_normalized, email, telefono, celular, provincia").eq("deleted", false),
    db.from("cxc_client_overrides").select("*"),
  ]);

  type MasterRow = { nombre_normalized: string; email?: string | null; telefono?: string | null; celular?: string | null; provincia?: string | null };
  type OverrideRow = { nombre_normalized: string; correo?: string | null; telefono?: string | null; celular?: string | null; contacto?: string | null; resultado_contacto?: string | null; proximo_seguimiento?: string | null };

  const masterMap = new Map<string, MasterRow>((master ?? []).map((m: MasterRow) => [m.nombre_normalized, m]));
  const overrideMap = new Map<string, OverrideRow>((overrides ?? []).map((o: OverrideRow) => [o.nombre_normalized, o]));

  // ── 4) Armar filas en el shape que espera la UI (igual que cxc_aging) ──────
  const rows = Array.from(agg.values())
    .map((e) => {
      const m = masterMap.get(e.nombre_normalized);
      const o = overrideMap.get(e.nombre_normalized);
      return {
        ...e,
        correo: o?.correo ?? m?.email ?? "",
        telefono: o?.telefono ?? m?.telefono ?? "",
        celular: o?.celular ?? m?.celular ?? "",
        contacto: o?.contacto ?? "",
        pais: "Panamá",
        provincia: m?.provincia ?? "",
        distrito: "",
        corregimiento: "",
        override_resultado: o?.resultado_contacto ?? null,
        override_seguimiento: o?.proximo_seguimiento ?? null,
      };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  // Upload sintético: usa el último synced_at para el indicador de frescura.
  const upload = latestSynced
    ? { id: "switch", uploaded_at: latestSynced, filename: "Switch (sync automático)" }
    : null;

  return NextResponse.json({ rows, upload });
}
