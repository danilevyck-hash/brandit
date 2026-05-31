// Server Component — módulo Ventas (single-empresa Boston, 4 sub-tabs).
// Auth admin-only (igual que el guard server anterior). Los datos los cargan
// los sub-tabs vía /api/ventas/* (client-fetch). Acá solo gateamos + años.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth-brandit";
import VentasShell from "@/components/ventas/VentasShell";

export const dynamic = "force-dynamic";

export default async function VentasPage() {
  const cookie = cookies().get("brandit_session")?.value;
  const session = verifySession(cookie);
  if (!session || session.role !== "admin") redirect("/");

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMes = now.getMonth() + 1;
  // Historia arranca 2022-10; años disponibles 2022..año en curso (desc).
  const years: number[] = [];
  for (let y = currentYear; y >= 2022; y--) years.push(y);

  return <VentasShell years={years} currentYear={currentYear} currentMes={currentMes} />;
}
