"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

type NavLink = { href: string; label: string; match: (p: string) => boolean };

const ALL_LINKS: NavLink[] = [
  { href: "/", label: "Cotizaciones", match: (p) => p === "/" || p.startsWith("/cotizacion") },
  { href: "/caja", label: "Caja", match: (p) => p.startsWith("/caja") },
  { href: "/guias", label: "Guías", match: (p) => p.startsWith("/guias") },
  { href: "/cxc", label: "CxC", match: (p) => p.startsWith("/cxc") },
  { href: "/leads", label: "Leads", match: (p) => p.startsWith("/leads") },
  { href: "/admin/usuarios", label: "Usuarios", match: (p) => p.startsWith("/admin/usuarios") },
];

const ROLE_LINKS: Record<string, string[]> = {
  admin: ["/", "/caja", "/guias", "/cxc", "/leads", "/admin/usuarios"],
  secretaria: ["/", "/caja", "/guias", "/cxc", "/leads"],
  vendedora: ["/leads"],
};

export default function Navbar() {
  const pathname = usePathname();
  const [role, setRole] = useState<string>("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setRole(localStorage.getItem("brandit_role") || "");
  }, [pathname]);

  useEffect(() => {
    const handleStorage = () => {
      setRole(localStorage.getItem("brandit_role") || "");
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const allowed = ROLE_LINKS[role] || [];
  const links = ALL_LINKS.filter((l) => allowed.includes(l.href));

  const handleLogout = () => {
    localStorage.removeItem("brandit_role");
    localStorage.removeItem("brandit_email");
    localStorage.removeItem("brandit_nombre");
    localStorage.removeItem("brandit_empresa");
    document.cookie = "brandit_session=; path=/; max-age=0";
    window.location.href = "/login";
  };

  return (
    <nav className="bg-brandit-black relative z-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/">
            <img src="/brandit-logo.svg" alt="Brand It" className="h-8 w-8 object-contain rounded" />
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  link.match(pathname)
                    ? "bg-brandit-orange text-white"
                    : "text-gray-300 hover:text-white hover:bg-white/10"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-brandit-orange transition-colors ml-1"
            >
              Salir
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden text-white p-2"
            aria-label="Menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu overlay */}
      {menuOpen && (
        <div className="fixed inset-0 top-14 bg-black/50 z-40 md:hidden" onClick={() => setMenuOpen(false)} />
      )}

      {/* Mobile menu dropdown */}
      {menuOpen && (
        <div className="md:hidden absolute top-14 left-0 right-0 bg-brandit-black border-t border-white/10 z-50 shadow-lg">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className={`block py-4 px-6 text-sm font-medium transition-colors ${
                link.match(pathname)
                  ? "bg-brandit-orange text-white"
                  : "text-gray-300 hover:text-white hover:bg-white/5"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <button
            onClick={handleLogout}
            className="block w-full text-left py-4 px-6 text-sm font-medium text-gray-400 hover:text-brandit-orange transition-colors border-t border-white/10"
          >
            Salir
          </button>
        </div>
      )}
    </nav>
  );
}
