"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import Avatar from "./Avatar";

type NavLink = { href: string; label: string; match: (p: string) => boolean };

const ALL_LINKS: NavLink[] = [
  { href: "/", label: "Inicio", match: (p) => p === "/" },
  { href: "/cotizaciones", label: "Cotizaciones", match: (p) => p === "/cotizaciones" || p.startsWith("/cotizacion") },
  { href: "/caja", label: "Caja", match: (p) => p.startsWith("/caja") },
  { href: "/guias", label: "Guías", match: (p) => p.startsWith("/guias") },
  { href: "/notas-entrega", label: "Notas", match: (p) => p.startsWith("/notas-entrega") },
  { href: "/cxc", label: "CxC", match: (p) => p.startsWith("/cxc") },
  { href: "/leads", label: "Leads", match: (p) => p.startsWith("/leads") },
  { href: "/admin/usuarios", label: "Usuarios", match: (p) => p === "/admin/usuarios" },
  { href: "/admin/log", label: "Log", match: (p) => p === "/admin/log" },
];

const ROLE_LINKS: Record<string, string[]> = {
  admin: ["/", "/cotizaciones", "/caja", "/guias", "/notas-entrega", "/cxc", "/leads", "/admin/usuarios", "/admin/log"],
  secretaria: ["/", "/caja", "/guias", "/notas-entrega", "/cxc", "/leads"],
  vendedora: ["/leads"],
};

type SearchResultLead = { id: string; nombre: string; empresa: string; estado: string; estado_venta: string };
type SearchResultCxc = { id: string; nombre: string; total: number; d_91_120: number; d_121_180: number; d_181_270: number; d_271_365: number; d_mas_365: number };

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<string>("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLeads, setSearchLeads] = useState<SearchResultLead[]>([]);
  const [searchCxc, setSearchCxc] = useState<SearchResultCxc[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [dark, setDark] = useState(false);
  const [nombre, setNombre] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setRole(localStorage.getItem("brandit_role") || "");
    setNombre(localStorage.getItem("brandit_nombre") || "");
    setDark(document.documentElement.classList.contains("dark"));
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

  const canSeeBadge = role === "admin" || role === "secretaria";

  // Fetch pending leads count
  const fetchPending = useCallback(async () => {
    if (!canSeeBadge) return;
    try {
      const res = await fetch("/api/leads/pendientes");
      const data = await res.json();
      setPendingCount(data.count || 0);
    } catch { /* ignore */ }
  }, [canSeeBadge]);

  useEffect(() => {
    fetchPending();
    if (!canSeeBadge) return;
    const interval = setInterval(fetchPending, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchPending, canSeeBadge]);

  // Search
  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setSearchLeads([]);
      setSearchCxc([]);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
      const data = await res.json();
      setSearchLeads(data.leads || []);
      setSearchCxc(data.cxc || []);
    } catch { /* ignore */ }
    setSearchLoading(false);
  }, []);

  const handleSearchInput = (val: string) => {
    setSearchQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 300);
  };

  const openSearch = () => {
    setSearchOpen(true);
    setSearchQuery("");
    setSearchLeads([]);
    setSearchCxc([]);
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery("");
    setSearchLeads([]);
    setSearchCxc([]);
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && searchOpen) closeSearch();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [searchOpen]);

  const allowed = ROLE_LINKS[role] || [];
  const links = ALL_LINKS.filter((l) => allowed.includes(l.href));

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("brandit_dark_mode", "1");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.removeItem("brandit_dark_mode");
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem("brandit_role");
    localStorage.removeItem("brandit_email");
    localStorage.removeItem("brandit_nombre");
    localStorage.removeItem("brandit_empresa");
    await fetch("/api/auth", { method: "DELETE" });
    window.location.href = "/login";
  };

  const getCxcStatus = (row: SearchResultCxc) => {
    const vencido = Number(row.d_121_180) + Number(row.d_181_270) + Number(row.d_271_365) + Number(row.d_mas_365);
    if (vencido > 0) return "Vencido";
    if (Number(row.d_91_120) > 0) return "Vigilancia";
    return "Corriente";
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("es-PA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n));

  return (
    <>
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
                  className={`relative px-3 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] flex items-center ${
                    link.match(pathname)
                      ? "bg-brandit-orange text-white"
                      : "text-gray-300 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {link.label}
                  {link.href === "/leads" && canSeeBadge && pendingCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                      {pendingCount}
                    </span>
                  )}
                </Link>
              ))}
              {canSeeBadge && (
                <button
                  onClick={openSearch}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-colors ml-1"
                  aria-label="Buscar"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              )}
              <button
                onClick={toggleDark}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-colors ml-1"
                aria-label="Toggle dark mode"
              >
                {dark ? "☀️" : "🌙"}
              </button>
              {nombre && <Avatar nombre={nombre} size="sm" />}
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
                className={`block py-4 px-6 text-sm font-medium transition-colors relative ${
                  link.match(pathname)
                    ? "bg-brandit-orange text-white"
                    : "text-gray-300 hover:text-white hover:bg-white/5"
                }`}
              >
                {link.label}
                {link.href === "/leads" && canSeeBadge && pendingCount > 0 && (
                  <span className="absolute top-3 right-6 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {pendingCount}
                  </span>
                )}
              </Link>
            ))}
            <button
              onClick={toggleDark}
              className="block w-full text-left py-4 px-6 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-colors border-t border-white/10"
            >
              {dark ? "☀️ Modo claro" : "🌙 Modo oscuro"}
            </button>
            <button
              onClick={handleLogout}
              className="block w-full text-left py-4 px-6 text-sm font-medium text-gray-400 hover:text-brandit-orange transition-colors border-t border-white/10"
            >
              Salir
            </button>
          </div>
        )}
      </nav>

      {/* Search Modal */}
      {searchOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-[60]" onClick={closeSearch} />
          <div className="fixed inset-x-0 top-0 z-[70] flex justify-center pt-[15vh]">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Buscar leads o clientes CxC..."
                  value={searchQuery}
                  onChange={(e) => handleSearchInput(e.target.value)}
                  className="w-full text-lg outline-none bg-transparent placeholder-gray-400"
                />
              </div>
              <div className="max-h-[50vh] overflow-y-auto">
                {searchLoading && (
                  <p className="text-center text-gray-400 text-sm py-6">Buscando...</p>
                )}
                {!searchLoading && searchQuery.length >= 2 && searchLeads.length === 0 && searchCxc.length === 0 && (
                  <p className="text-center text-gray-400 text-sm py-6">No se encontraron resultados</p>
                )}
                {searchLeads.length > 0 && (
                  <div className="px-5 py-3">
                    <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-2">Leads</p>
                    {searchLeads.map((l) => (
                      <button
                        key={l.id}
                        onClick={() => { closeSearch(); router.push("/leads"); }}
                        className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-between"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900">{l.nombre}</p>
                          {l.empresa && <p className="text-xs text-gray-400">{l.empresa}</p>}
                        </div>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          l.estado_venta === "convertido" ? "bg-green-100 text-green-700" :
                          l.estado_venta === "no_convertido" || l.estado_venta === "perdido" ? "bg-red-50 text-red-400" :
                          "bg-green-50 text-green-600"
                        }`}>
                          {l.estado_venta === "convertido" ? "Convertido" :
                           l.estado_venta === "no_convertido" || l.estado_venta === "perdido" ? "No Conv." :
                           l.estado === "prospecto" || l.estado === "interesado" ? "Prospecto" : "No Califica"}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {searchCxc.length > 0 && (
                  <div className="px-5 py-3 border-t border-gray-50">
                    <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-2">CxC</p>
                    {searchCxc.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => { closeSearch(); router.push("/cxc"); }}
                        className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-between"
                      >
                        <p className="text-sm font-medium text-gray-900">{c.nombre}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 tabular-nums">${fmt(c.total)}</span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            getCxcStatus(c) === "Vencido" ? "bg-red-50 text-red-600" :
                            getCxcStatus(c) === "Vigilancia" ? "bg-yellow-50 text-yellow-600" :
                            "bg-green-50 text-green-600"
                          }`}>
                            {getCxcStatus(c)}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="px-5 py-2.5 border-t border-gray-100 text-center">
                <p className="text-[10px] text-gray-400">ESC para cerrar</p>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
