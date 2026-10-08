import Link from "next/link";
import { ContactStudio } from "@/components/ContactStudio";
import { getUser } from "@/lib/auth";
import { directory } from "@/lib/studio";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ ciudad: string }> }) {
  const { ciudad } = await params;
  return { title: `Estudios de tatuaje en ${ciudad.replace(/-/g, " ")}` };
}

export default async function Ciudad({ params, searchParams }: { params: Promise<{ ciudad: string }>; searchParams: Promise<{ prueba?: string }> }) {
  const { ciudad } = await params;
  const sp = await searchParams;
  const [{ studios }, user] = await Promise.all([directory(ciudad), getUser()]);
  const jobId = sp.prueba && /^[0-9a-f-]{36}$/.test(sp.prueba) ? sp.prueba : undefined;
  const name = studios[0]?.city ?? ciudad.replace(/-/g, " ");
  return (
    <div className="wrap max-w-4xl py-14">
      <Link href="/directorio" className="link text-sm">Todas las ciudades</Link>
      <h1 className="mt-2 text-[clamp(2.2rem,5vw,3.8rem)]">Estudios en {name}</h1>
      {studios.length === 0 ? (
        <p className="notice mt-8 max-w-xl">No hay estudios en esta ciudad todavía.</p>
      ) : (
        <ul className="mt-10 grid gap-4">
          {studios.map((s) => (
            <li key={s.id} className="panel grid gap-4 p-6 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <h2 className="text-3xl">{s.name}</h2>
                <p className="mt-1 text-bone/75">{s.city}{s.featured ? " · Destacado" : ""}</p>
                {s.instagram && <a className="link mt-2 inline-block text-sm" href={`https://instagram.com/${s.instagram}`} target="_blank" rel="noopener noreferrer">@{s.instagram}</a>}
              </div>
              <ContactStudio orgId={s.id} orgName={s.name} jobId={jobId} signedIn={Boolean(user)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
