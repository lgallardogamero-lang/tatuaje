export function Legal({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <article className="wrap max-w-3xl py-14">
      <p className="notice error mb-8 text-sm">
        <strong>Borrador pendiente de revisión legal.</strong> Este texto es una propuesta redactada sin intervención de un abogado. Los datos entre corchetes están por completar. No publicar sin revisarlo.
      </p>
      <h1 className="text-[clamp(2.2rem,5vw,3.6rem)]">{title}</h1>
      <p className="hint mt-2">Última actualización: {updated}</p>
      <div className="mt-8 grid gap-5 text-bone/85 [&_h2]:mt-6 [&_h2]:text-2xl [&_li]:ml-5 [&_li]:list-disc [&_ul]:grid [&_ul]:gap-1.5">{children}</div>
    </article>
  );
}
