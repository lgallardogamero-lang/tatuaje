import { getCloudflareContext } from "@opennextjs/cloudflare";

/** Bindings y variables de Cloudflare. En tests se puede sustituir con `setTestEnv`. */
let testEnv: CloudflareEnv | null = null;
export function setTestEnv(env: CloudflareEnv | null) {
  testEnv = env;
}

export function getEnv(): CloudflareEnv {
  if (testEnv) return testEnv;
  return getCloudflareContext().env as CloudflareEnv;
}

export function waitUntil(p: Promise<unknown>) {
  if (testEnv) {
    void p.catch(() => {});
    return;
  }
  getCloudflareContext().ctx.waitUntil(p);
}

export function isSecureUrl(env: CloudflareEnv): boolean {
  return env.APP_URL.startsWith("https://");
}
