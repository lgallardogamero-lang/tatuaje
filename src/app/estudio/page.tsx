import Link from "next/link";
import { redirect } from "next/navigation";
import { StudioPanel } from "@/components/StudioPanel";
import { getUser } from "@/lib/auth";
import { getMembership, overview } from "@/lib/studio";
import { getEnv } from "@/lib/env";

export const metadata = { title: "Mi estudio" };
export const dynamic = "force-dynamic";

export default async function Estudio() {
  const user = await getUser();
  if (!user) redirect("/entrar");
  const m = await getMembership(user.id);
  if (!m) redirect("/estudios");
  const data = await overview(m.orgId);
  return (
    <div className="wrap grid max-w-4xl gap-10 py-14">
      <div>
        <h1 className="text-[clamp(2.2rem,5vw,3.6rem)]">{data.org.name}</h1>
        <p className="mt-2 text-bone/75">{data.org.city} · Plan {data.org.plan === "none" ? "sin activar" : data.org.plan} · {m.role === "owner" ? "Eres el responsable" : "Eres tatuador del estudio"}</p>
      </div>
      {!data.org.active && <p className="notice error" role="alert">El plan de tu estudio no está activo, así que no se pueden generar pruebas con el cupo del estudio. Escríbenos para activarlo.</p>}
      <div className="flex flex-wrap gap-3">
        <Link href="/crear" className="btn btn-primary">Probar un tatuaje con un cliente</Link>
      </div>
      <StudioPanel data={data} isOwner={m.role === "owner"} selfId={user.id} shareUrl={`${getEnv().APP_URL.replace(/\/$/, "")}/e/${data.org.slug}`} />
    </div>
  );
}
