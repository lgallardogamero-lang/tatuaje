import { HttpError, requireUser } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { createJob, getJob } from "@/lib/jobs";
import { all } from "@/lib/db";
import { getObject } from "@/lib/storage";
import { LIMITS } from "@/lib/config";
import { hit } from "@/lib/ratelimit";
import { jobOptionsSchema } from "@/lib/schema";

/** Regenerar = nuevo trabajo con las mismas fotos y opciones; cuesta otro crédito. */
export const POST = handle(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const job = await getJob(id!, user.id);
  if (!job) throw new HttpError(404, "No encontramos esa prueba");
  if (!(await hit(`jobs:${user.id}`, LIMITS.jobsPerUserPerHour, 3600_000))) throw new HttpError(429, "Has hecho muchas pruebas seguidas. Espera un rato");
  const rows = await all<{ kind: string; r2_key: string }>("SELECT kind, r2_key FROM assets WHERE job_id = ? AND kind IN ('photo','mask','reference')", job.id);
  const files: Record<string, { bytes: Uint8Array; contentType: string }> = {};
  for (const r of rows) {
    const o = await getObject(r.r2_key);
    if (o) files[r.kind] = o;
  }
  if (!files["photo"]) throw new HttpError(410, "La foto ya se borró. Sube una nueva para volver a probar");
  const options = jobOptionsSchema.parse(JSON.parse(job.options));
  const newId = await createJob({ userId: user.id, orgId: job.org_id, options, photo: files["photo"], mask: files["mask"], reference: files["reference"] });
  return json({ id: newId }, 201);
});
