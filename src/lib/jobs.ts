import { all, one, run, now } from "./db";
import { getEnv, waitUntil } from "./env";
import { newId } from "./ids";
import { DATA_RETENTION_HOURS, FREE_VARIANTS, VARIANTS_PER_GENERATION } from "./config";
import { refund, spend } from "./credits";
import { deleteObjects, getObject, keyFor, putObject } from "./storage";
import { getProvider } from "./providers";
import { TransientProviderError, type ImageBytes } from "./providers/types";
import { applyWatermark } from "./watermark";
import { buildApplyPrompt, buildDesignPrompt } from "@/prompts/v1";
import type { JobOptions } from "./schema";

export type JobStatus = "queued" | "running" | "done" | "failed" | "cancelled";

export interface JobRow {
  id: string;
  user_id: string;
  org_id: string | null;
  flash_id: string | null;
  variants: number;
  status: JobStatus;
  options: string;
  progress: number;
  stage: string | null;
  error: string | null;
  charge: "credit" | "org" | "refunded";
  created_at: number;
  updated_at: number;
  expires_at: number;
}

export interface UploadedImage extends ImageBytes {}

async function recordUsage(done: boolean, images: number) {
  const day = new Date().toISOString().slice(0, 10);
  await run(
    `INSERT INTO usage_daily (day, jobs_done, jobs_failed, images) VALUES (?, ?, ?, ?)
     ON CONFLICT(day) DO UPDATE SET jobs_done = jobs_done + excluded.jobs_done, jobs_failed = jobs_failed + excluded.jobs_failed, images = images + excluded.images`,
    day,
    done ? 1 : 0,
    done ? 0 : 1,
    images,
  );
}

export class NoCreditsError extends Error {}
export class QuotaError extends Error {}

const monthKey = () => new Date().toISOString().slice(0, 7);

/** Cobra la generación: a la cuota mensual del estudio si hay org, o 1 crédito del usuario. */
async function charge(userId: string, jobId: string, orgId: string | null): Promise<"credit" | "org"> {
  if (orgId) {
    const month = monthKey();
    await run("INSERT OR IGNORE INTO org_usage (org_id, month, used) VALUES (?, ?, 0)", orgId, month);
    const ok = await run(
      `UPDATE org_usage SET used = used + 1 WHERE org_id = ? AND month = ?
       AND used < (SELECT monthly_quota FROM organizations WHERE id = ? AND subscription_status = 'active')`,
      orgId,
      month,
      orgId,
    );
    if (ok !== 1) throw new QuotaError("El estudio ha agotado las generaciones de este mes o no tiene suscripción activa");
    return "org";
  }
  if (!(await spend(userId, 1, "generation", jobId, jobId))) throw new NoCreditsError("No te quedan créditos");
  return "credit";
}

/** Devuelve el cobro de un trabajo una sola vez (cancelación o fallo). */
export async function refundJob(jobId: string): Promise<void> {
  const job = await one<Pick<JobRow, "user_id" | "org_id" | "charge">>("SELECT user_id, org_id, charge FROM jobs WHERE id = ?", jobId);
  if (!job || job.charge === "refunded") return;
  const flipped = await run("UPDATE jobs SET charge = 'refunded' WHERE id = ? AND charge = ?", jobId, job.charge);
  if (flipped !== 1) return;
  if (job.charge === "credit") await refund(job.user_id, 1, jobId, jobId);
  else if (job.org_id) await run("UPDATE org_usage SET used = used - 1 WHERE org_id = ? AND month = ? AND used > 0", job.org_id, monthKey());
}

export interface CreateJobInput {
  userId: string;
  orgId?: string | null;
  options: JobOptions;
  photo: UploadedImage;
  mask?: UploadedImage;
  reference?: UploadedImage;
}

export async function createJob(input: CreateJobInput): Promise<string> {
  const id = newId();
  const created = now();
  const orgId = input.orgId ?? null;
  const how = await charge(input.userId, id, orgId);
  // Quien aún no ha comprado créditos (ni es un estudio) recibe 1 variante; quien ha comprado, las 3.
  const hasPurchased = Boolean(orgId) || Boolean(await one("SELECT 1 FROM credit_ledger WHERE user_id = ? AND reason = 'purchase' LIMIT 1", input.userId));
  const variants = hasPurchased ? VARIANTS_PER_GENERATION : FREE_VARIANTS;
  try {
    const expires = created + DATA_RETENTION_HOURS * 3600_000;
    await run(
      `INSERT INTO jobs (id, user_id, org_id, flash_id, status, options, charge, variants, created_at, updated_at, expires_at)
       VALUES (?, ?, ?, ?, 'queued', ?, ?, ?, ?, ?, ?)`,
      id,
      input.userId,
      orgId,
      input.options.flashId ?? null,
      JSON.stringify(input.options),
      how,
      variants,
      created,
      created,
      expires,
    );
    const items: [string, UploadedImage | undefined][] = [
      ["photo", input.photo],
      ["mask", input.mask],
      ["reference", input.reference],
    ];
    for (const [kind, img] of items) {
      if (!img) continue;
      await storeAsset(id, input.userId, kind as "photo" | "mask" | "reference", img, 0, expires);
    }
    await enqueue(id);
  } catch (e) {
    await run("UPDATE jobs SET status = 'failed', error = 'No se pudo crear el trabajo', updated_at = ? WHERE id = ?", now(), id);
    await refundJob(id);
    throw e;
  }
  return id;
}

async function storeAsset(
  jobId: string,
  userId: string,
  kind: "photo" | "mask" | "reference" | "design" | "design_wm" | "variant" | "variant_wm",
  img: ImageBytes,
  position: number,
  expiresAt: number | null,
) {
  const key = keyFor(userId, jobId, `${kind}-${position}`);
  await putObject(key, img.bytes, img.contentType);
  await run(
    "INSERT INTO assets (id, job_id, user_id, kind, r2_key, content_type, position, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    newId(),
    jobId,
    userId,
    kind,
    key,
    img.contentType,
    position,
    expiresAt,
    now(),
  );
}

export async function enqueue(jobId: string): Promise<void> {
  const env = getEnv();
  if (env.QUEUE_MODE === "manual") return; // solo pruebas: el llamador ejecuta processJob a mano
  if (env.QUEUE_MODE === "queue" && env.JOBS) {
    await env.JOBS.send({ jobId });
    return;
  }
  // Modo "inline" (desarrollo): se procesa tras responder.
  waitUntil(processJob(jobId));
}

async function setProgress(jobId: string, progress: number, stage: string) {
  await run("UPDATE jobs SET progress = ?, stage = ?, updated_at = ? WHERE id = ? AND status = 'running'", progress, stage, now(), jobId);
}

async function isCancelled(jobId: string) {
  const r = await one<{ status: JobStatus }>("SELECT status FROM jobs WHERE id = ?", jobId);
  return !r || r.status === "cancelled";
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (!(e instanceof TransientProviderError) || i === attempts - 1) throw e;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
    }
  }
  throw last;
}

async function loadAsset(jobId: string, kind: string): Promise<ImageBytes | undefined> {
  const a = await one<{ r2_key: string }>("SELECT r2_key FROM assets WHERE job_id = ? AND kind = ? ORDER BY position LIMIT 1", jobId, kind);
  if (!a) return undefined;
  return (await getObject(a.r2_key)) ?? undefined;
}

/** Ejecuta un trabajo de principio a fin. Es idempotente: si ya no está en cola, no hace nada. */
export async function processJob(jobId: string): Promise<void> {
  const started = await run("UPDATE jobs SET status = 'running', progress = 5, stage = 'Preparando', updated_at = ? WHERE id = ? AND status = 'queued'", now(), jobId);
  if (started !== 1) return;
  const job = await one<JobRow>("SELECT * FROM jobs WHERE id = ?", jobId);
  if (!job) return;
  try {
    const options = JSON.parse(job.options) as JobOptions;
    const provider = getProvider();
    const photo = await loadAsset(jobId, "photo");
    if (!photo) throw new Error("Falta la foto");
    const mask = await loadAsset(jobId, "mask");
    const reference = await loadAsset(jobId, "reference");
    const expires = job.expires_at;

    // Paso 1: el diseño como imagen independiente.
    await setProgress(jobId, 15, "Dibujando el diseño");
    let design: ImageBytes;
    if (job.flash_id) {
      const flash = await one<{ r2_key: string }>("SELECT r2_key FROM flash_designs WHERE id = ? AND org_id = ?", job.flash_id, job.org_id);
      const obj = flash ? await getObject(flash.r2_key) : null;
      if (!obj) throw new Error("No se encontró el diseño del catálogo");
      design = obj;
    } else {
      design = await withRetry(() =>
        provider.createDesign({
          prompt: buildDesignPrompt(options),
          seed: options.description || options.style,
          style: options.style,
          color: options.color,
          reference,
        }),
      );
    }
    if (await isCancelled(jobId)) return;
    await run("UPDATE jobs SET images = ? WHERE id = ?", job.flash_id ? 0 : 1, jobId);
    await storeAsset(jobId, job.user_id, "design", design, 0, expires);
    // Los resultados del modo estudio salen limpios (paga el estudio): no hay marca de agua.
    const mark = (img: ImageBytes) => (job.org_id ? Promise.resolve(img) : applyWatermark(img));
    await storeAsset(jobId, job.user_id, "design_wm", await mark(design), 0, expires);

    // Paso 2: aplicarlo sobre la piel dentro de la máscara.
    await setProgress(jobId, 45, "Tatuando la piel");
    const variants = await withRetry(() =>
      provider.applyToSkin({
        photo,
        mask,
        design,
        prompt: buildApplyPrompt(options),
        variants: job.variants,
        placement: options.placement,
        seed: `${jobId}:${options.description}`,
      }),
    );
    await run("UPDATE jobs SET images = ? WHERE id = ?", (job.flash_id ? 0 : 1) + variants.length, jobId);
    if (await isCancelled(jobId)) return;
    await setProgress(jobId, 85, "Revelando el resultado");
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i]!;
      await storeAsset(jobId, job.user_id, "variant", v, i, expires);
      await storeAsset(jobId, job.user_id, "variant_wm", await mark(v), i, expires);
    }
    const done = await run(
      "UPDATE jobs SET status = 'done', progress = 100, stage = 'Listo', updated_at = ? WHERE id = ? AND status = 'running'",
      now(),
      jobId,
    );
    if (done !== 1) await purgeJobFiles(jobId); // se canceló mientras terminaba
    else {
      await recordUsage(true, (job.flash_id ? 0 : 1) + variants.length);
      if (job.org_id) {
        // Descargas HD y stencil incluidas en el plan del estudio, sin alargar la retención de 24 h.
        for (const kind of ["hd", "stencil"]) {
          await run("INSERT OR IGNORE INTO entitlements (id, user_id, job_id, kind, created_at) VALUES (?, ?, ?, ?, ?)", newId(), job.user_id, jobId, kind, now());
        }
      }
    }
    if (job.flash_id) await run("UPDATE flash_designs SET tried_count = tried_count + 1 WHERE id = ?", job.flash_id);
  } catch (e) {
    console.error("processJob falló", jobId, e);
    await run(
      "UPDATE jobs SET status = 'failed', stage = NULL, error = ?, updated_at = ? WHERE id = ? AND status IN ('running','queued')",
      "No se pudo generar el tatuaje. No se ha descontado ningún crédito.",
      now(),
      jobId,
    );
    await refundJob(jobId);
    // Las imágenes ya generadas antes del fallo también cuestan dinero.
    const partial = await one<{ images: number }>("SELECT images FROM jobs WHERE id = ?", jobId);
    await recordUsage(false, partial?.images ?? 0);
  }
}

export async function cancelJob(jobId: string, userId: string): Promise<boolean> {
  const changed = await run(
    "UPDATE jobs SET status = 'cancelled', stage = NULL, updated_at = ? WHERE id = ? AND user_id = ? AND status IN ('queued','running')",
    now(),
    jobId,
    userId,
  );
  if (changed !== 1) return false;
  await refundJob(jobId);
  return true;
}

/** Reintento manual tras un fallo: cuesta otro crédito, así que se crea un trabajo nuevo desde el cliente. */

export async function getJob(jobId: string, userId: string): Promise<JobRow | null> {
  return one<JobRow>("SELECT * FROM jobs WHERE id = ? AND user_id = ?", jobId, userId);
}

export const listJobs = (userId: string, limit = 30) =>
  all<JobRow>("SELECT * FROM jobs WHERE user_id = ? AND status != 'failed' ORDER BY created_at DESC LIMIT ?", userId, limit);

export async function purgeJobFiles(jobId: string): Promise<void> {
  const rows = await all<{ r2_key: string }>("SELECT r2_key FROM assets WHERE job_id = ?", jobId);
  await deleteObjects(rows.map((r) => r.r2_key));
  await run("DELETE FROM assets WHERE job_id = ?", jobId);
}

/** Borra a mano todas las fotos y resultados de un usuario. */
export async function purgeUserFiles(userId: string): Promise<number> {
  const jobs = await all<{ id: string }>("SELECT id FROM jobs WHERE user_id = ?", userId);
  for (const j of jobs) await purgeJobFiles(j.id);
  await run("DELETE FROM jobs WHERE user_id = ? AND status NOT IN ('queued','running')", userId);
  return jobs.length;
}

/**
 * Cron horario (además de la regla de ciclo de vida de R2).
 * 1) Las fotos subidas por el usuario (foto, máscara, referencia) se borran siempre a las 24 h.
 * 2) Los trabajos caducados se borran enteros, salvo los que tienen una compra (HD/stencil), cuyo
 *    `expires_at` se alarga al comprar para que el usuario conserve lo que pagó.
 */
export async function purgeExpired(): Promise<number> {
  const cutoff = now() - DATA_RETENTION_HOURS * 3600_000;
  const uploads = await all<{ id: string; r2_key: string }>(
    "SELECT id, r2_key FROM assets WHERE kind IN ('photo','mask','reference') AND created_at < ?",
    cutoff,
  );
  await deleteObjects(uploads.map((r) => r.r2_key));
  for (const a of uploads) await run("DELETE FROM assets WHERE id = ?", a.id);

  const rows = await all<{ id: string }>("SELECT id FROM jobs WHERE expires_at < ? AND status NOT IN ('queued','running')", now());
  for (const j of rows) {
    await purgeJobFiles(j.id);
    await run("DELETE FROM jobs WHERE id = ?", j.id);
  }
  await run("DELETE FROM magic_links WHERE expires_at < ?", now() - 86400_000);
  await run("DELETE FROM sessions WHERE expires_at < ?", now());
  return rows.length;
}
