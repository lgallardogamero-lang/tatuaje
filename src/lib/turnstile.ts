import { getEnv } from "./env";

/** Verifica Cloudflare Turnstile. Sin TURNSTILE_SECRET no se exige (desarrollo). */
export async function verifyTurnstile(token: string | undefined, ip: string): Promise<boolean> {
  const secret = getEnv().TURNSTILE_SECRET;
  if (!secret) return true;
  if (!token) return false;
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: new URLSearchParams({ secret, response: token, remoteip: ip }),
  });
  const data = (await res.json()) as { success?: boolean };
  return Boolean(data.success);
}
