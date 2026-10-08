// Punto de entrada del Worker en Cloudflare: la web (OpenNext) más el consumidor de la cola y la tarea horaria.
// @ts-ignore: el archivo lo genera `opennextjs-cloudflare build`
import openNext from "./.open-next/worker.js";
import { handleQueue, handleScheduled } from "./src/lib/worker-handlers";

export default {
  fetch: openNext.fetch,
  async queue(batch: Parameters<typeof handleQueue>[0], env: CloudflareEnv, ctx: { waitUntil(p: Promise<unknown>): void }) {
    await handleQueue(batch, env, ctx);
  },
  async scheduled(_event: unknown, env: CloudflareEnv, ctx: { waitUntil(p: Promise<unknown>): void }) {
    ctx.waitUntil(handleScheduled(env, ctx));
  },
};

// Si activas la caché incremental de OpenNext con Durable Objects, reexporta aquí sus clases:
// @ts-ignore
export { DOQueueHandler, DOShardedTagCache } from "./.open-next/worker.js";
