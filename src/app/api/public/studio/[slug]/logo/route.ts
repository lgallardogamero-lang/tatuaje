import { HttpError } from "@/lib/auth";
import { handle } from "@/lib/api";
import { logoOf, publicStudio } from "@/lib/studio";
import { getObject } from "@/lib/storage";

/** Logo público de un estudio activo y visible en el directorio. */
export const GET = handle(async (_req, { params }) => {
  const { slug } = await params;
  const s = await publicStudio(slug!);
  const l = s ? await logoOf(s.id) : null;
  const obj = l ? await getObject(l.key) : null;
  if (!obj) throw new HttpError(404, "Sin logo");
  return new Response(obj.bytes as BodyInit, {
    headers: { "Content-Type": obj.contentType, "Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" },
  });
});
