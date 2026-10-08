import type { Metadata, Viewport } from "next";
import "@fontsource/gloock/400.css";
import "@fontsource-variable/hanken-grotesk";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { CookieConsent } from "@/components/CookieConsent";

export const metadata: Metadata = {
  title: { default: "Calco: pruébate el tatuaje antes de hacértelo", template: "%s · Calco" },
  description: "Sube una foto de tu piel, describe el tatuaje y míralo puesto. Simulación con IA. Tus fotos se borran en 24 horas.",
  robots: { index: true, follow: true },
  // Define NEXT_PUBLIC_APP_URL al compilar con tu dominio real (https://...) para que las imágenes sociales usen rutas absolutas.
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  openGraph: {
    type: "website",
    locale: "es_ES",
    siteName: "Calco",
    title: "Calco: pruébate el tatuaje antes de hacértelo",
    description: "Sube una foto de tu piel, describe el tatuaje y míralo puesto. Tus fotos se borran en 24 horas.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Calco: un tatuaje que se dibuja sobre la piel" }],
  },
  twitter: { card: "summary_large_image", title: "Calco: pruébate el tatuaje antes de hacértelo", images: ["/og.png"] },
};

export const viewport: Viewport = { themeColor: "#0e1014", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-scroll-behavior="smooth">
      <body>
        <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[200] focus:rounded focus:bg-stencil focus:px-4 focus:py-2 focus:text-ink">
          Saltar al contenido
        </a>
        <SiteHeader />
        <main id="contenido">{children}</main>
        <SiteFooter />
        <CookieConsent />
      </body>
    </html>
  );
}
