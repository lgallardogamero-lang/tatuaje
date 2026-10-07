import type { Metadata, Viewport } from "next";
import "@fontsource/gloock/400.css";
import "@fontsource-variable/hanken-grotesk";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: { default: "Calco: pruébate el tatuaje antes de hacértelo", template: "%s · Calco" },
  description: "Sube una foto de tu piel, describe el tatuaje y míralo puesto. Simulación con IA. Tus fotos se borran en 24 horas.",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { themeColor: "#0e1014", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[200] focus:rounded focus:bg-stencil focus:px-4 focus:py-2 focus:text-ink">
          Saltar al contenido
        </a>
        <SiteHeader />
        <main id="contenido">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
