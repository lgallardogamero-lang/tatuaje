import Link from "next/link";
import { Logo } from "./Logo";
import { getUser } from "@/lib/auth";
import { balance } from "@/lib/credits";
import { getMembership } from "@/lib/studio";

export async function SiteHeader() {
  let user = null;
  let credits = 0;
  let studio = false;
  try {
    user = await getUser();
    if (user) {
      credits = await balance(user.id);
      studio = Boolean(await getMembership(user.id));
    }
  } catch {
    // sin base de datos disponible (p. ej. durante la compilación): cabecera pública
  }
  return (
    <header className="sticky top-0 z-50 border-b border-line/70 bg-ink/85 backdrop-blur">
      <div className="wrap flex h-16 items-center justify-between gap-4">
        <Link href="/" className="rounded focus-visible:outline-offset-4">
          <Logo />
        </Link>
        <nav aria-label="Principal" className="flex items-center gap-1 sm:gap-3">
          <Link href="/estudios" className="btn btn-quiet hidden sm:inline-flex">Para estudios</Link>
          {user ? (
            <>
              {studio && <Link href="/estudio" className="btn btn-quiet">Mi estudio</Link>}
              {user.role === "admin" && <Link href="/admin" className="btn btn-quiet">Administración</Link>}
              <Link href="/cuenta" className="btn btn-quiet" aria-label={`Tu cuenta, ${credits} créditos`}>
                <span className="text-stencil">{credits}</span>
                <span className="hidden sm:inline">créditos</span>
              </Link>
              <Link href="/crear" className="btn btn-primary btn-sm">Probar un tatuaje</Link>
            </>
          ) : (
            <>
              <Link href="/entrar" className="btn btn-quiet">Entrar</Link>
              <Link href="/crear" className="btn btn-primary btn-sm">Probar gratis</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
