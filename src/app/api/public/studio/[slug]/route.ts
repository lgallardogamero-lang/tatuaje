import { HttpError } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { publicStudio } from "@/lib/studio";

export const GET = handle(async (_req, { params }) => {
  const { slug } = await params;
  const s = await publicStudio(slug!);
  if (!s) throw new HttpError(404, "Estudio no disponible");
  return json({ id: s.id, name: s.name, slug: s.slug, city: s.city }, 200, { "Cache-Control": "public, max-age=60" });
});
