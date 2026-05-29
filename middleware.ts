import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession } from "@/lib/auth-brandit";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname === "/login" ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get("brandit_session")?.value;

  // Sin cookie → al login.
  if (!cookie) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Cookie presente pero inválida/expirada → borrarla y mandar al login.
  // (Antes el middleware solo chequeaba presencia: una cookie vieja/expirada
  // pasaba acá pero los API la rechazaban con 401, rompiendo el dashboard.)
  if (!verifySession(cookie)) {
    const res = NextResponse.redirect(new URL("/login", req.url));
    res.cookies.delete("brandit_session");
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
