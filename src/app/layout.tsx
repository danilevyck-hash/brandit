import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import NavbarWrapper from "@/components/NavbarWrapper";
import { ToastProvider } from "@/components/Toast";

const inter = Inter({ subsets: ["latin"] });

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
  maximumScale: 1,
  themeColor: "#F15A29",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="apple-touch-icon" href="/brandit-logo.svg" />
      </head>
      <script dangerouslySetInnerHTML={{__html: `try{if(localStorage.getItem('brandit_dark_mode')==='1')document.documentElement.classList.add('dark')}catch(e){}`}} />
      <body className={`${inter.className} bg-cream min-h-screen`}>
        <ToastProvider>
          <NavbarWrapper />
          <main className="pb-10">{children}</main>
        </ToastProvider>
      </body>
    </html>
  );
}
