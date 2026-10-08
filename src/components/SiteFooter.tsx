import Link from "next/link";
import { Logo } from "./Logo";
import { CookieSettingsButton } from "./CookieSettingsButton";

export function SiteFooter() {
  return (
    <footer className="mt-32 border-t border-line">
      <div className="wrap grid gap-10 py-14 md:grid-cols-[1.2fr_1fr_1fr]">
        <div className="grid content-start gap-4">
          <Logo />
          <p className="hint max-w-[44ch]">
            Simulación orientativa: el resultado real depende del tatuador, de tu piel y de cómo cicatrice. Usa Calco para decidir y llévale el diseño a tu tatuador.
          </p>
        </div>
        <nav aria-label="Producto" className="grid content-start gap-2 text-[0.95rem]">
          <Link href="/crear" className="hover:text-stencil">Probar un tatuaje</Link>
          <Link href="/#precios" className="hover:text-stencil">Precios</Link>
          <Link href="/estudios" className="hover:text-stencil">Para estudios</Link>
          <Link href="/#preguntas" className="hover:text-stencil">Preguntas frecuentes</Link>
        </nav>
        <nav aria-label="Legal" className="grid content-start gap-2 text-[0.95rem]">
          <Link href="/privacidad" className="hover:text-stencil">Privacidad</Link>
          <Link href="/terminos" className="hover:text-stencil">Condiciones de uso</Link>
          <Link href="/aviso-legal" className="hover:text-stencil">Aviso legal</Link>
          <Link href="/cookies" className="hover:text-stencil">Cookies</Link>
          <CookieSettingsButton />
        </nav>
      </div>
      <div className="wrap border-t border-line py-6 hint">Tus fotos se borran automáticamente a las 24 horas.</div>
    </footer>
  );
}
