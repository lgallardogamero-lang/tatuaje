import Link from "next/link";
import { directory } from "@/lib/studio";

export const metadata = { title: "Estudios de tatuaje" };
export const dynamic = "force-dynamic";

export default async function Directorio({ searchParams }: { searchParams: Promise<{ prueba?: string }> }) {
  const sp = await searchParams;
  const { cities } = await directory();
  const q = sp.prueba && /^[0-9a-f-]{36}$/.test(sp.prueba) ? `?prueba=${sp.prueba}` : "";
  return (
    <div className="wrap max-w-4xl py-14">
      <h1 className="text-[clamp(2.2rem,5vw,3.8rem)]">Estudios de tatuaje cerca de ti</h1>
      <p className="measure mt-4 text-bone/80">Estudios que usan Calco. Cuando tengas tu diseño, contacta con el que mejor te encaje y llévale tu prueba.</p>
      {cities.length === 0 ? (
        <p className="notice mt-8 max-w-xl">Aún no hay estudios en el directorio. Estamos abriendo el programa para estudios. <Link className="link" href="/estudios">Ver cómo funciona</Link></p>
      ) : (
        <ul className="mt-10 grid gap-3 sm:grid-cols-2">
          {cities.map((c) => (
            <li key={c.slug}>
              <Link href={`/directorio/${c.slug}${q}`} className="flex items-center justify-between rounded-[10px] border border-line p-5 hover:border-stencil">
                <span className="display text-2xl">{c.city}</span>
                <span className="text-bone/75">{c.count} {c.count === 1 ? "estudio" : "estudios"}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
