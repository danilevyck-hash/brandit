import { requireRoles, type Role } from "@/lib/auth-brandit";
import { NextRequest, NextResponse } from "next/server";

const GUIAS_ROLES: readonly Role[] = ["admin", "secretaria"];

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = requireRoles(req, GUIAS_ROLES);
  if (auth instanceof NextResponse) return auth;

  // Email apagado en Brand It: sin RESEND_API_KEY el envío es no-op.
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ ok: true, skipped: "email-off" });
  }

  const { subject, body } = await req.json();
  const RESEND_KEY = process.env.RESEND_API_KEY;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_KEY}` },
      body: JSON.stringify({
        from: "Confecciones Boston <pedidos@example.com>",
        to: ["info@example.com"],
        subject,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px">${body}</div>`,
      }),
    });
    if (!res.ok) { const err = await res.json(); return NextResponse.json({ error: err.message }, { status: 500 }); }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err); return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
