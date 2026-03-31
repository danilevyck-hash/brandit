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
  }, [pathname]);

  useEffect(() => {
    const handleStorage = () => {
      setRole(localStorage.getItem("brandit_role") || "");
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
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
    <nav className="bg-brandit-black">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          <Link href="/" className="flex flex-col">
            <span className="text-xl font-bold tracking-tight uppercase leading-none">
              <span className="text-white">BRAND</span>
              <span className="text-brandit-blue">/</span>
              <span className="text-white">IT</span>
              <span className="text-brandit-orange">.</span>
            </span>
            <span className="text-[9px] text-gray-500 font-medium tracking-wide">by Confecciones Boston</span>
          </Link>
          <div className="flex items-center gap-1">
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
        </div>
      </div>
    </nav>
  );
}
