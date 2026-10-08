import { withEnv } from "./env";
import { processJob, purgeExpired } from "./jobs";
import { cleanupRateLimits } from "./ratelimit";

type Ctx = { waitUntil(p: Promise<unknown>): void };
interface QueueMessage {
  body: { jobId: string };
  ack(): void;
  retry(): void;
}

/**
 * Consumidor de la cola de generaciones. `processJob` es idempotente (solo toma trabajos "en cola"),
 * y gestiona sus propios errores y reembolsos; un fallo inesperado reintenta el mensaje.
 */
export async function handleQueue(batch: { messages: readonly QueueMessage[] }, env: CloudflareEnv, ctx: Ctx): Promise<void> {
  await withEnv(env, ctx, async () => {
    for (const msg of batch.messages) {
      try {
        await processJob(msg.body.jobId);
        msg.ack();
      } catch (e) {
        console.error("Cola: error procesando", msg.body.jobId, e);
        msg.retry();
      }
    }
  });
}

/** Tarea horaria: borra fotos y trabajos caducados, sesiones viejas y contadores de límites antiguos. */
export async function handleScheduled(env: CloudflareEnv, ctx: Ctx): Promise<{ purgedJobs: number }> {
  return withEnv(env, ctx, async () => {
    const purgedJobs = await purgeExpired();
    await cleanupRateLimits();
    return { purgedJobs };
  });
}
