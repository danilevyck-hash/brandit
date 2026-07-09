import type { Metadata, Viewport } from "next";
import { Inter, Outfit, Space_Mono } from "next/font/google";
import "./globals.css";
import NavbarWrapper from "@/components/NavbarWrapper";
import { ToastProvider } from "@/components/Toast";

const inter = Inter({ subsets: ["latin"] });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });
const spaceMono = Space_Mono({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-space-mono" });

export const metadata: Metadata = {
  title: "Brand It | Confecciones Boston",
  description: "Control de costos de producción",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Brand It",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // viewportFit cover → habilita env(safe-area-inset-*) bajo el notch/Dynamic Island.
  viewportFit: "cover",
  // maximumScale eliminado: bloquear el pinch-zoom es un problema de accesibilidad.
  themeColor: "#F15A29",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/brandit-logo.svg" />
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('brandit_dark_mode')==='1')document.documentElement.classList.add('dark')}catch(e){}`,
          }}
        />
      </head>
      <body className={`${inter.className} ${outfit.variable} ${spaceMono.variable} bg-cream min-h-screen`}>
        <ToastProvider>
          <NavbarWrapper />
          <main className="pb-10">{children}</main>
        </ToastProvider>
      </body>
    </html>
  );
}
