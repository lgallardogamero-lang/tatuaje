import { requireUser } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { getJob } from "@/lib/jobs";
import { all, one } from "@/lib/db";
import { HttpError } from "@/lib/auth";

export const GET = handle(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const job = await getJob(id!, user.id);
  if (!job) throw new HttpError(404, "No encontramos esa prueba");
  const assets = await all<{ kind: string; position: number; content_type: string }>(
    "SELECT kind, position, content_type FROM assets WHERE job_id = ?",
    job.id,
  );
  const ent = await all<{ kind: string }>("SELECT kind FROM entitlements WHERE job_id = ?", job.id);
  const studio = job.org_id
    ? await one<{ name: string; accent_color: string; logo_key: string | null }>("SELECT name, accent_color, logo_key FROM organizations WHERE id = ?", job.org_id)
    : null;
  return json({
    id: job.id,
    status: job.status,
    progress: job.progress,
    stage: job.stage,
    error: job.error,
    expiresAt: job.expires_at,
    options: JSON.parse(job.options),
    variants: assets.filter((a) => a.kind === "variant_wm").length,
    hasOriginal: assets.some((a) => a.kind === "photo"),
    entitlements: ent.map((e) => e.kind),
    studio: studio ? { name: studio.name, accent: studio.accent_color, hasLogo: Boolean(studio.logo_key) } : null,
  });
});
