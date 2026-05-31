// POST notify — envío de email via Resend. TRAS FLAG: Brand It aún NO tiene
// Resend configurado (sin RESEND_API_KEY ni dominio propio). Si no hay key,
// es no-op (devuelve skipped:true) para no romper el flujo del frontend.
// TODO(brandit): configurar RESEND_API_KEY + dominio/correos de Brand It
// (NO usar los de fashiongr) y completar `from`/`to`.
import { NextRequest, NextResponse } from "next/server";
import { requireRoles } from "@/lib/auth-brandit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = requireRoles(req, ["admin", "secretaria", "vendedora1", "vendedora2"]);
  if (auth instanceof NextResponse) return auth;

  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) {
    // Flag no-op: email deshabilitado hasta configurar Resend en Brand It.
    return NextResponse.json({ ok: true, skipped: true, reason: "Email no configurado en Brand It" });
  }

  const { subject, body } = await req.json();
  // TODO(brandit): reemplazar from/to por el dominio/correos reales de Brand It.
  const FROM = process.env.GUIAS_EMAIL_FROM;
  const TO = process.env.GUIAS_EMAIL_TO;
  if (!FROM || !TO) {
    return NextResponse.json({ ok: true, skipped: true, reason: "GUIAS_EMAIL_FROM/TO no configurados" });
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_KEY}` },
      body: JSON.stringify({ from: FROM, to: [TO], subject, html: `<div style="font-family:Arial,sans-serif;max-width:600px">${body}</div>` }),
    });
    if (!res.ok) { const e = await res.json(); return NextResponse.json({ error: e.message }, { status: 500 }); }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/guias/notify]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
