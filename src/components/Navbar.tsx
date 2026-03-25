"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { supabaseAuth } from "@/lib/supabase-auth";

type NavLink = { href: string; label: string; match: (p: string) => boolean };

const ALL_LINKS: NavLink[] = [
  { href: "/", label: "Cotizaciones", match: (p) => p === "/" || p.startsWith("/cotizacion") },
  { href: "/caja", label: "Caja", match: (p) => p.startsWith("/caja") },
  { href: "/guias", label: "Guías", match: (p) => p.startsWith("/guias") },
  { href: "/cxc", label: "CxC", match: (p) => p.startsWith("/cxc") },
  { href: "/leads", label: "Leads", match: (p) => p.startsWith("/leads") },
  { href: "/admin/usuarios", label: "Usuarios", match: (p) => p.startsWith("/admin") },
];

const ROLE_LINKS: Record<string, string[]> = {
  admin: ["/", "/caja", "/guias", "/cxc", "/leads", "/admin/usuarios"],
  secretaria: ["/", "/caja", "/guias", "/cxc", "/leads"],
  vendedora: ["/leads"],
};

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<string>("");

  useEffect(() => {
    setRole(localStorage.getItem("brandit_role") || "");
  }, []);

  const allowed = ROLE_LINKS[role] || [];
  const links = ALL_LINKS.filter((l) => allowed.includes(l.href));

  const handleLogout = async () => {
    await supabaseAuth.auth.signOut();
    localStorage.removeItem("brandit_role");
    localStorage.removeItem("brandit_email");
    localStorage.removeItem("brandit_nombre");
    router.push("/login");
  };

  return (
    <nav className="bg-white border-b border-gray-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          <Link href="/" className="flex items-baseline gap-1.5">
            <span className="text-navy font-extrabold text-xl tracking-tight">Brand It</span>
            <span className="text-[10px] text-gray-400 font-medium">by Confecciones Boston</span>
          </Link>
          <div className="flex items-center gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  link.match(pathname)
                    ? "bg-navy text-white"
                    : "text-gray-500 hover:text-navy hover:bg-gray-50"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors ml-1"
            >
              Salir
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
