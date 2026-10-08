import Link from "next/link";
import { notFound } from "next/navigation";
import { ContactStudio } from "@/components/ContactStudio";
import { getUser } from "@/lib/auth";
import { publicStudio } from "@/lib/studio";
import { FREE_CREDITS } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const s = await publicStudio((await params).slug);
  return s ? { title: `Prueba tu tatuaje en ${s.name}`, description: `Mira cómo te quedaría un tatuaje antes de hacértelo con ${s.name}.` } : {};
}

/** Página de captación de un estudio: con su marca, para compartir en Instagram, en un QR o en su web. */
export default async function PaginaEstudio({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [s, user] = await Promise.all([publicStudio(slug), getUser()]);
  if (!s) notFound();
  return (
    <div className="wrap grid max-w-3xl gap-8 py-16" style={{ "--color-stencil": s.accent } as React.CSSProperties}>
      <div className="flex items-center gap-4">
        {s.hasLogo && /* eslint-disable-next-line @next/next/no-img-element */ <img src={`/api/public/studio/${s.slug}/logo`} alt={`Logo de ${s.name}`} className="h-14 w-auto max-w-52 rounded-sm object-contain" />}
        <div>
          <p className="text-xl font-semibold">{s.name}</p>
          <p className="text-bone/75">{s.city}{s.instagram ? <> · <a className="link" href={`https://instagram.com/${s.instagram}`} target="_blank" rel="noopener noreferrer">@{s.instagram}</a></> : null}</p>
        </div>
      </div>
      <h1 className="text-[clamp(2.4rem,6vw,4.4rem)]">Mira tu tatuaje antes de hacértelo</h1>
      <p className="measure text-[1.1rem] text-bone/85">
        Sube una foto de tu piel, describe lo que tienes en mente y míralo puesto. Cuando lo tengas claro, escríbenos y lo hacemos realidad en {s.name}.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/crear?e=${s.slug}`} className="btn btn-primary text-[1.05rem]">Probar un tatuaje</Link>
        <ContactStudio orgId={s.id} orgName={s.name} signedIn={Boolean(user)} />
      </div>
      <p className="hint">{FREE_CREDITS} pruebas gratis. Tus fotos se borran a las 24 horas y solo las ves tú. Funciona con la tecnología de <Link className="link" href="/">Calco</Link>.</p>
    </div>
  );
}
