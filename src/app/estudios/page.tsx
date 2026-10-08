import Link from "next/link";
import { STUDIO_PLANS, eur } from "@/lib/config";
import { StudioRequestForm } from "@/components/StudioRequestForm";
import { getUser } from "@/lib/auth";
import { myLatestRequest } from "@/lib/studio-requests";
import { getMembership } from "@/lib/studio";

export const metadata = { title: "Para estudios de tatuaje" };

export const dynamic = "force-dynamic";

export default async function Estudios() {
  const user = await getUser();
  const [req, member] = user ? await Promise.all([myLatestRequest(user.id), getMembership(user.id)]) : [null, null];
  return (
    <div className="wrap py-14">
      <h1 className="max-w-[18ch] text-[clamp(2.4rem,6vw,4.6rem)]">Que tus clientes vean el tatuaje antes de reservar</h1>
      <p className="measure mt-5 text-[1.1rem] text-bone/80">
        Calco para estudios: el cliente se ve el diseño puesto durante la consulta, duda menos y cierras más citas. Se usa en un minuto con una tablet, sin instalar nada.
      </p>
      <p className="notice mt-8 max-w-2xl">
        <strong>Estamos dando de alta los primeros estudios.</strong> Ya incluye cuentas con varios tatuadores, modo estudio para usar con el cliente, catálogo de flash, directorio por ciudad y solicitudes de clientes. Tu logo y colores y el widget para tu web llegarán más adelante. Estos son los planes previstos.
      </p>
      <div className="mt-10 grid gap-px overflow-hidden rounded-[10px] border border-line bg-line md:grid-cols-3">
        {Object.entries(STUDIO_PLANS).map(([id, p]) => (
          <div key={id} className="grid content-start gap-5 bg-ink p-7">
            <h2 className="text-3xl">{p.label}</h2>
            <p><span className="display text-5xl">{eur(p.priceCents)}</span> <span className="text-mute">al mes</span></p>
            <p className="text-bone/80">{p.quota} generaciones al mes</p>
            <ul className="grid gap-2 text-[0.95rem] text-bone/80">
              {p.features.map((f) => (
                <li key={f} className="ml-5 list-disc">{f}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="hint mt-4">Precios orientativos, con IVA incluido. Pueden cambiar antes del lanzamiento.</p>
      <div className="mt-12 max-w-3xl">
        {member ? (
          <div className="panel grid gap-3 p-6"><h2 className="text-2xl">Tu estudio ya está en Calco</h2><Link href="/estudio" className="btn btn-primary w-fit">Ir a Mi estudio</Link></div>
        ) : (
          <StudioRequestForm signedIn={Boolean(user)} status={req?.status ?? null} />
        )}
      </div>
      <Link href="/" className="btn btn-ghost mt-10">Volver al inicio</Link>
    </div>
  );
}
