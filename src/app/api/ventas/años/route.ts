import { NextRequest, NextResponse } from "next/server";
import { requireRoles } from "@/lib/auth-brandit";
import { fetchAvailableYears } from "@/lib/ventas/queries";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = requireRoles(req, ["admin"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const years = await fetchAvailableYears();
    return NextResponse.json(years);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "error inesperado";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
