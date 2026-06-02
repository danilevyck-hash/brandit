// ─────────────────────────────────────────────────────────────────────────────
// Auth Brand It — cookie HMAC firmado con payload {role, userId, exp}
//
// Reemplaza el patrón anterior (hash estático "brandit-valid") por payload
// firmado JWT-style sin librería externa (Node crypto nativo).
//
// Migración: usuarios actuales tienen cookies viejas (hash estático) que
// quedan inválidas → deben loguearse de nuevo. Una vez. Es esperado.
//
// Server-side = fuente de verdad para autorización. localStorage del
// frontend queda como cache UX (mostrar nombre/role en UI), no para
// decisiones de seguridad.
// ─────────────────────────────────────────────────────────────────────────────

import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

export type Role = "admin" | "secretaria" | "vendedora";

export const ALL_ROLES: readonly Role[] = ["admin", "secretaria", "vendedora"];
const ROLE_SET = new Set<string>(ALL_ROLES);

export interface SessionPayload {
  role: Role;
  userId: string;
  /** Unix ms. Sesión expira a los 30 días por default. */
  exp: number;
  /** Opcional, sólo para logging/UI server-side. */
  nombre?: string;
}

// ─── Encoding helpers ────────────────────────────────────────────────────────

function base64UrlEncode(buf: Buffer | string): string {
  const b = typeof buf === "string" ? Buffer.from(buf, "utf-8") : buf;
  return b.toString("base64").replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64UrlDecode(s: string): Buffer {
  let padded = s.replace(/-/g, "+").replace(/_/g, "/");
  while (padded.length % 4) padded += "=";
  return Buffer.from(padded, "base64");
}

// ─── Sign / verify ───────────────────────────────────────────────────────────

function hmac(payloadB64: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(payloadB64).digest();
}

/** Devuelve el cookie value firmado. Throws si AUTH_SECRET no está configurado. */
export function signSession(payload: SessionPayload): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET no configurado");
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const sig = hmac(payloadB64, secret);
  return `${payloadB64}.${base64UrlEncode(sig)}`;
}

/**
 * Decodifica + valida HMAC + chequea expiración. Devuelve null si:
 *   - cookie malformado
 *   - firma inválida
 *   - payload expirado
 *   - role desconocido
 * Constant-time comparison para evitar timing attacks.
 */
export function verifySession(cookie: string | undefined | null): SessionPayload | null {
  if (!cookie) return null;
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;

  const parts = cookie.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;

  const expected = hmac(payloadB64, secret);
  let provided: Buffer;
  try {
    provided = base64UrlDecode(sigB64);
  } catch {
    return null;
  }
  if (expected.length !== provided.length) return null;
  if (!timingSafeEqual(expected, provided)) return null;

  let payload: SessionPayload;
  try {
    payload = JSON.parse(base64UrlDecode(payloadB64).toString("utf-8"));
  } catch {
    return null;
  }
  if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
  if (typeof payload.role !== "string" || !ROLE_SET.has(payload.role)) return null;
  if (typeof payload.userId !== "string" || !payload.userId) return null;
  return payload;
}

// ─── Request helpers ─────────────────────────────────────────────────────────

/** Devuelve el role del cookie firmado, o null si no autenticado / inválido. */
export function getSessionRole(req: NextRequest): Role | null {
  const cookie = req.cookies.get("brandit_session")?.value;
  return verifySession(cookie)?.role ?? null;
}

/** Devuelve el payload completo, o null si no autenticado / inválido. */
export function getSessionPayload(req: NextRequest): SessionPayload | null {
  const cookie = req.cookies.get("brandit_session")?.value;
  return verifySession(cookie);
}

/**
 * Gate para handlers de API routes.
 *   - Si el role está en `allowed` → devuelve el role (continuar handler).
 *   - Si no hay cookie / inválido → NextResponse 401.
 *   - Si el role no está autorizado → NextResponse 403.
 *
 * Uso típico:
 *   const auth = requireRoles(req, ["admin"]);
 *   if (auth instanceof NextResponse) return auth;
 *   // auth es el role validado
 */
export function requireRoles(
  req: NextRequest,
  allowed: readonly Role[]
): Role | NextResponse {
  const cookie = req.cookies.get("brandit_session")?.value;
  if (!cookie) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const payload = verifySession(cookie);
  if (!payload) {
    return NextResponse.json({ error: "Sesión inválida o expirada" }, { status: 401 });
  }
  if (!allowed.includes(payload.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  return payload.role;
}

/** Cualquier usuario logueado, sin restringir por role. */
export function requireAnyAuth(req: NextRequest): SessionPayload | NextResponse {
  const cookie = req.cookies.get("brandit_session")?.value;
  if (!cookie) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const payload = verifySession(cookie);
  if (!payload) {
    return NextResponse.json({ error: "Sesión inválida o expirada" }, { status: 401 });
  }
  return payload;
}
