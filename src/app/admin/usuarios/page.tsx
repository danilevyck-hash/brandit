"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const USERS = [
  { nombre: "David", role: "admin" },
  { nombre: "Secretaria", role: "secretaria" },
  { nombre: "Vendedora 1", role: "vendedora" },
  { nombre: "Vendedora 2", role: "vendedora" },
];

export default function UsuariosPage() {
  const router = useRouter();

  useEffect(() => {
    const role = localStorage.getItem("brandit_role");
    if (role !== "admin") {
      router.push("/");
    }
  }, [router]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-10">
        <h1 className="text-4xl font-extrabold text-brandit-black tracking-tight">Usuarios</h1>
        <p className="text-sm text-gray-400 mt-1">Roles del sistema</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-50 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left">
              <th className="px-5 py-3 text-xs font-semibold text-brandit-black">Nombre</th>
              <th className="px-5 py-3 text-xs font-semibold text-brandit-black">Rol</th>
            </tr>
          </thead>
          <tbody>
            {USERS.map((u) => (
              <tr key={u.nombre} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-5 py-3 text-gray-900 font-medium">{u.nombre}</td>
                <td className="px-5 py-3">
                  <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${
                    u.role === "admin" ? "bg-brandit-orange/10 text-brandit-black" :
                    u.role === "secretaria" ? "bg-blue-50 text-blue-600" :
                    "bg-gray-100 text-gray-500"
                  }`}>
                    {u.role}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
