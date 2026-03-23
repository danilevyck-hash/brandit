"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="bg-white border-b border-gray-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          <Link href="/" className="flex items-baseline gap-1.5">
            <span className="text-navy font-extrabold text-xl tracking-tight">Brand It</span>
            <span className="text-[10px] text-gray-400 font-medium">by Confecciones Boston</span>
          </Link>
          <div className="flex gap-1">
            <Link
              href="/"
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                pathname === "/"
                  ? "bg-navy text-white"
                  : "text-gray-500 hover:text-navy hover:bg-gray-50"
              }`}
            >
              Cotizaciones
            </Link>
            <Link
              href="/cotizacion/nueva"
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                pathname === "/cotizacion/nueva"
                  ? "bg-navy text-white"
                  : "text-gray-500 hover:text-navy hover:bg-gray-50"
              }`}
            >
              + Nueva
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
