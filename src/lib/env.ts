import { AsyncLocalStorage } from "node:async_hooks";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/** Bindings y variables de Cloudflare. En tests se puede sustituir con `setTestEnv`. */
let testEnv: CloudflareEnv | null = null;
export function setTestEnv(env: CloudflareEnv | null) {
  testEnv = env;
}

/**
 * Entorno para código que corre fuera de una petición web (consumidor de la cola, tarea programada):
 * ahí OpenNext no ha preparado su contexto, así que lo fijamos nosotros con `withEnv`.
 */
const scoped = new AsyncLocalStorage<{ env: CloudflareEnv; ctx: { waitUntil(p: Promise<unknown>): void } }>();

export function withEnv<T>(env: CloudflareEnv, ctx: { waitUntil(p: Promise<unknown>): void }, fn: () => Promise<T>): Promise<T> {
  return scoped.run({ env, ctx }, fn);
}

export function getEnv(): CloudflareEnv {
  const s = scoped.getStore();
  if (s) return s.env;
  if (testEnv) return testEnv;
  return getCloudflareContext().env as CloudflareEnv;
}

export function waitUntil(p: Promise<unknown>) {
  const s = scoped.getStore();
  if (s) {
    s.ctx.waitUntil(p);
    return;
  }
  if (testEnv) {
    void p.catch(() => {});
    return;
  }
  getCloudflareContext().ctx.waitUntil(p);
}

export function isSecureUrl(env: CloudflareEnv): boolean {
  return env.APP_URL.startsWith("https://");
}
