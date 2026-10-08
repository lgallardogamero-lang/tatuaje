import Link from "next/link";
import { HeroSkin } from "@/components/HeroSkin";
import { StyleStrip } from "@/components/StyleStrip";
import { CREDIT_PACKS, FREE_CREDITS, eur } from "@/lib/config";

const STEPS = [
  { t: "Sube la foto", d: "De tu brazo, pierna, espalda o la zona que quieras. Desde la galería o con la cámara." },
  { t: "Cuéntanos el diseño", d: "Descríbelo con palabras, sube una referencia o combina las dos cosas." },
  { t: "Colócalo", d: "Pinta la zona con el dedo, muévelo, ajusta el tamaño y gíralo hasta que encaje." },
  { t: "Compáralo", d: "Recibes el resultado aplicado a tu piel y lo comparas con tu foto original deslizando." },
];

const FAQ = [
  { q: "¿Qué hacéis con mis fotos?", a: "Las usamos solo para generar tu simulación. Se borran automáticamente a las 24 horas, y puedes borrarlas antes desde tu cuenta con un botón." },
  { q: "¿Se parecerá al tatuaje real?", a: "Es una simulación orientativa. Sirve para decidir tamaño, zona y estilo; el resultado final depende de tu tatuador, de tu piel y de la cicatrización." },
  { q: "¿Cuánto cuesta?", a: `Tienes ${FREE_CREDITS} pruebas gratis al registrarte, con una variante y marca de agua. Después compras créditos sueltos, sin suscripción: cada prueba de pago te da tres variantes.` },
  { q: "¿Puedo llevarle el diseño a mi tatuador?", a: "Sí. Puedes descargar el diseño en limpio y en versión stencil, lista para imprimir y transferir." },
  { q: "¿Qué fotos no admitís?", a: "Desnudos, imágenes de menores y contenido violento o de odio. Hay que ser mayor de edad para usar Calco." },
  { q: "¿Soy un estudio de tatuaje, puedo usarlo con mis clientes?", a: "Sí, hay un modo estudio pensado para usarlo con el cliente en una tablet. Mira la página de estudios." },
];

export default function Home() {
  return (
    <>
      <section className="wrap grid items-center gap-10 pb-16 pt-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-14 lg:pb-24 lg:pt-16">
        <div className="grid gap-7">
          <h1 className="text-[clamp(2.6rem,6.4vw,5.2rem)]">Pruébate el tatuaje antes de hacértelo</h1>
          <p className="measure text-[1.15rem] text-bone/80">
            Sube una foto de tu piel, describe el diseño y míralo puesto, con tu tono de piel, tu luz y tus sombras. Decide con calma y llévale el diseño a tu tatuador.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/crear" className="btn btn-primary text-[1.05rem]">Prueba tu tatuaje gratis</Link>
            <Link href="#estilos" className="btn btn-ghost">Ver estilos</Link>
          </div>
          <p className="hint">{FREE_CREDITS} pruebas gratis. Sin tarjeta. Tus fotos se borran en 24 horas.</p>
        </div>
        <HeroSkin />
      </section>

      <section className="wrap py-20" aria-labelledby="como">
        <h2 id="como" className="text-[clamp(2rem,4vw,3.2rem)]">Cuatro pasos y lo ves puesto</h2>
        <ol className="relative mt-12 grid gap-10 md:grid-cols-4 md:gap-6">
          <span aria-hidden="true" className="absolute left-[0.95rem] top-2 hidden h-[calc(100%-1rem)] w-px bg-line max-md:block md:left-0 md:top-[0.95rem] md:h-px md:w-full" />
          {STEPS.map((s, i) => (
            <li key={s.t} className="relative grid gap-3 pl-12 md:pl-0 md:pt-12">
              <span className="absolute left-0 top-0 grid h-8 w-8 place-items-center rounded-full border border-stencil bg-ink text-sm font-bold text-stencil">{i + 1}</span>
              <h3 className="text-2xl">{s.t}</h3>
              <p className="text-bone/75">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="estilos" className="py-16" aria-labelledby="estilos-t">
        <div className="wrap mb-8 flex flex-wrap items-end justify-between gap-4">
          <h2 id="estilos-t" className="text-[clamp(2rem,4vw,3.2rem)]">Diez estilos, desde la línea fina al japonés</h2>
          <Link href="/crear" className="btn btn-ghost btn-sm">Elegir mi estilo</Link>
        </div>
        <StyleStrip />
      </section>

      <section className="wrap grid gap-12 py-20 md:grid-cols-2" aria-labelledby="porque">
        <h2 id="porque" className="text-[clamp(2rem,4vw,3.2rem)] md:sticky md:top-28 md:self-start">Menos dudas antes de sentarte en la silla</h2>
        <div className="grid gap-9">
          <div>
            <h3 className="text-2xl">Lo ves en tu piel, no en una imagen suelta</h3>
            <p className="mt-2 text-bone/75">Respeta la curvatura del brazo, tu tono, la luz de la foto y las sombras, para que juzgues el tamaño y la colocación con realismo.</p>
          </div>
          <hr className="rule" />
          <div>
            <h3 className="text-2xl">Compara con tu foto original</h3>
            <p className="mt-2 text-bone/75">Desliza entre tu foto y el resultado. Con las pruebas de pago recibes tres variantes para quedarte con la que mejor te encaja.</p>
          </div>
          <hr className="rule" />
          <div>
            <h3 className="text-2xl">Listo para llevar al tatuador</h3>
            <p className="mt-2 text-bone/75">Descarga el diseño en limpio y en versión stencil. Menos vueltas en la consulta y más tiempo para lo que importa.</p>
          </div>
          <hr className="rule" />
          <div>
            <h3 className="text-2xl">Tu privacidad primero</h3>
            <p className="mt-2 text-bone/75">Las fotos se borran a las 24 horas y puedes eliminarlas cuando quieras. Sin redes sociales, sin publicar nada.</p>
          </div>
        </div>
      </section>

      <section id="precios" className="wrap py-20" aria-labelledby="precios-t">
        <h2 id="precios-t" className="text-[clamp(2rem,4vw,3.2rem)]">Empieza gratis, paga solo lo que uses</h2>
        <p className="measure mt-4 text-bone/75">Cada crédito es una prueba. Las gratuitas generan una variante; con créditos de pago recibes tres. Regenerar cuesta otro crédito. Sin suscripciones.</p>
        <div className="mt-10 grid gap-px overflow-hidden rounded-[10px] border border-line bg-line md:grid-cols-4">
          <div className="grid content-between gap-8 bg-ink p-7">
            <div>
              <p className="text-sm font-semibold text-stencil">Al registrarte</p>
              <p className="display mt-2 text-5xl">{FREE_CREDITS}</p>
              <p className="mt-1 text-bone/75">pruebas gratis, con una variante y marca de agua</p>
            </div>
            <Link href="/crear" className="btn btn-ghost">Empezar</Link>
          </div>
          {CREDIT_PACKS.map((p) => (
            <div key={p.id} className={`grid content-between gap-8 p-7 ${"highlight" in p ? "bg-panel-2" : "bg-ink"}`}>
              <div>
                <p className="text-sm font-semibold text-stencil">{p.label}</p>
                <p className="display mt-2 text-5xl">{p.credits}</p>
                <p className="mt-1 text-bone/75">créditos por {eur(p.priceCents)}</p>
                <p className="hint mt-1">{eur(Math.round(p.priceCents / p.credits))} cada uno</p>
              </div>
              <Link href="/crear" className={`btn ${"highlight" in p ? "btn-primary" : "btn-ghost"}`}>Elegir</Link>
            </div>
          ))}
        </div>
        <p className="hint mt-4">Precios con IVA incluido. La descarga HD sin marca de agua y el stencil se pagan aparte o con créditos.</p>
      </section>

      <section className="wrap py-10" aria-labelledby="estudios-t">
        <div className="grid gap-8 rounded-[10px] border border-stencil/40 bg-panel p-8 md:grid-cols-[1fr_auto] md:items-center md:p-12">
          <div className="grid gap-3">
            <h2 id="estudios-t" className="text-[clamp(1.8rem,3.4vw,2.8rem)]">¿Tienes un estudio de tatuaje?</h2>
            <p className="measure text-bone/80">Tus clientes ven cómo les queda el tatuaje en su piel antes de reservar. Dudan menos y cierras más citas. Modo estudio para la tablet, tu logo, widget para tu web y directorio por ciudad.</p>
          </div>
          <Link href="/estudios" className="btn btn-primary">Ver planes para estudios</Link>
        </div>
      </section>

      <section id="preguntas" className="wrap py-20" aria-labelledby="faq-t">
        <h2 id="faq-t" className="text-[clamp(2rem,4vw,3.2rem)]">Preguntas frecuentes</h2>
        <div className="mt-8 max-w-3xl divide-y divide-line border-y border-line">
          {FAQ.map((f) => (
            <details key={f.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-lg font-semibold [&::-webkit-details-marker]:hidden">
                {f.q}
                <span aria-hidden="true" className="text-2xl text-stencil transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 max-w-[60ch] text-bone/75">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
