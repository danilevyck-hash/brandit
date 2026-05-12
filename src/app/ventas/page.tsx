// Server Component — Tab Ventas.
// Lee year de searchParams, fetcha resumen + años disponibles en paralelo,
// pasa a VentasShell (client). Auth admin-only enforced server-side.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth-brandit";
import { fetchVentasResumen, fetchAvailableYears } from "@/lib/ventas/queries";
import VentasShell from "@/components/ventas/VentasShell";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: { year?: string };
};

export default async function VentasPage({ searchParams }: Props) {
  const cookie = cookies().get("brandit_session")?.value;
  const session = verifySession(cookie);
  if (!session || session.role !== "admin") redirect("/");

  const currentYear = new Date().getFullYear();
  const yearParam = searchParams.year ? parseInt(searchParams.year, 10) : currentYear;
  const year = Number.isFinite(yearParam) && yearParam > 1900 ? yearParam : currentYear;

  const [data, years] = await Promise.all([
    fetchVentasResumen({ year }),
    fetchAvailableYears(),
  ]);

  return <VentasShell data={data} years={years} year={year} />;
}
