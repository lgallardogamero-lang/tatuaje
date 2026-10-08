import { HttpError, requireUser } from "@/lib/auth";
import { handle } from "@/lib/api";
import { getJob } from "@/lib/jobs";
import { logoOf } from "@/lib/studio";
import { getObject } from "@/lib/storage";

/** Logo del estudio de una prueba hecha en modo estudio; solo lo ve quien hizo la prueba. */
export const GET = handle(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const job = await getJob(id!, user.id);
  if (!job?.org_id) throw new HttpError(404, "No encontrado");
  const l = await logoOf(job.org_id);
  const obj = l ? await getObject(l.key) : null;
  if (!obj) throw new HttpError(404, "Sin logo");
  return new Response(obj.bytes as BodyInit, {
    headers: { "Content-Type": obj.contentType, "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" },
  });
});
