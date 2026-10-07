import { HttpError, requireUser } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { LIMITS, MAX_IMAGE_BYTES } from "@/lib/config";
import { createJob, listJobs } from "@/lib/jobs";
import { jobOptionsSchema } from "@/lib/schema";
import { validateImage } from "@/lib/image-validation";
import { moderate } from "@/lib/moderation";
import { hit } from "@/lib/ratelimit";
import { all, one } from "@/lib/db";

async function readImage(form: FormData, field: string, required: boolean) {
  const f = form.get(field);
  if (!(f instanceof File) || f.size === 0) {
    if (required) throw new HttpError(400, field === "photo" ? "Falta la foto" : `Falta ${field}`);
    return undefined;
  }
  if (f.size > MAX_IMAGE_BYTES) throw new HttpError(400, "La imagen pesa demasiado (máximo 12 MB)");
  const bytes = new Uint8Array(await f.arrayBuffer());
  const v = validateImage(bytes);
  if (!v.ok) throw new HttpError(400, v.error);
  return { bytes, contentType: v.type as string };
}

const toDataUrl = (img: { bytes: Uint8Array; contentType: string }) => {
  let s = "";
  for (let i = 0; i < img.bytes.length; i += 0x8000) s += String.fromCharCode(...img.bytes.subarray(i, i + 0x8000));
  return `data:${img.contentType};base64,${btoa(s)}`;
};

export const POST = handle(async (req) => {
  const user = await requireUser();
  if (!(await hit(`jobs:${user.id}`, LIMITS.jobsPerUserPerHour, 3600_000))) throw new HttpError(429, "Has hecho muchas pruebas seguidas. Espera un rato");
  const form = await req.formData();
  const rawOptions = form.get("options");
  if (typeof rawOptions !== "string") throw new HttpError(400, "Faltan las opciones");
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawOptions);
  } catch {
    throw new HttpError(400, "Opciones no válidas");
  }
  const options = jobOptionsSchema.parse(parsed);
  const photo = (await readImage(form, "photo", true))!;
  const mask = await readImage(form, "mask", false);
  const reference = await readImage(form, "reference", false);
  if (options.hasReference && !reference) throw new HttpError(400, "Indicaste una referencia pero no se subió");

  // Moderación antes de gastar crédito ni llamar a la IA.
  const text = await moderate({ text: options.description });
  if (!text.ok) throw new HttpError(422, `No podemos generar este diseño: ${text.reason}`);
  for (const img of [photo, reference]) {
    if (!img) continue;
    const r = await moderate({ imageDataUrl: toDataUrl(img) });
    if (!r.ok) throw new HttpError(422, `No podemos usar esta imagen: ${r.reason}`);
  }

  let orgId: string | null = null;
  const studioMode = form.get("studio");
  if (typeof studioMode === "string" && studioMode) {
    const m = await one<{ org_id: string }>("SELECT org_id FROM memberships WHERE org_id = ? AND user_id = ?", studioMode, user.id);
    if (!m) throw new HttpError(403, "No perteneces a ese estudio");
    orgId = m.org_id;
  }
  if (options.flashId) {
    const ok = await one("SELECT 1 FROM flash_designs WHERE id = ? AND org_id = ?", options.flashId, orgId ?? "");
    if (!ok) throw new HttpError(400, "Ese diseño del catálogo no está disponible");
  }
  const id = await createJob({ userId: user.id, orgId, options, photo, mask, reference });
  return json({ id }, 201);
});

export const GET = handle(async () => {
  const user = await requireUser();
  const jobs = await listJobs(user.id);
  const ent = await all<{ job_id: string; kind: string }>("SELECT job_id, kind FROM entitlements WHERE user_id = ?", user.id);
  return json({
    jobs: jobs.map((j) => ({
      id: j.id,
      status: j.status,
      createdAt: j.created_at,
      expiresAt: j.expires_at,
      options: JSON.parse(j.options),
      entitlements: ent.filter((e) => e.job_id === j.id).map((e) => e.kind),
    })),
  });
});
