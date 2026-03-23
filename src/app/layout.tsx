import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Brand It | Confecciones Boston",
  description: "Control de costos de producción",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${inter.className} bg-cream min-h-screen`}>
        <Navbar />
        <main className="pb-10">{children}</main>
      </body>
    </html>
  );
}
