import Link from "next/link";

export const metadata = { title: "Página no encontrada" };

export default function NotFound() {
  return (
    <div className="wrap grid max-w-2xl gap-6 py-24">
      <p className="display text-7xl text-stencil" aria-hidden="true">404</p>
      <h1 className="text-[clamp(2rem,5vw,3.4rem)]">No encontramos esa página</h1>
      <p className="text-bone/80">Puede que el enlace esté mal escrito o que la prueba ya se haya borrado. Las pruebas se eliminan a las 24 horas.</p>
      <div className="flex flex-wrap gap-3">
        <Link href="/crear" className="btn btn-primary">Probar un tatuaje</Link>
        <Link href="/" className="btn btn-ghost">Volver al inicio</Link>
      </div>
    </div>
  );
}
