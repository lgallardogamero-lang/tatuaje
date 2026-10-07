import { all, one, run, now } from "./db";

/**
 * Limitador de ventana fija sobre D1. Devuelve true si la petición entra.
 * Es una defensa en profundidad; en producción conviene añadir además
 * las reglas de Rate Limiting de Cloudflare delante del Worker.
 */
export async function hit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const windowStart = Math.floor(now() / windowMs) * windowMs;
  await run(
    "INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1) ON CONFLICT(key, window_start) DO UPDATE SET count = count + 1",
    key,
    windowStart,
  );
  const row = await one<{ count: number }>("SELECT count FROM rate_limits WHERE key = ? AND window_start = ?", key, windowStart);
  return (row?.count ?? 1) <= limit;
}

export async function cleanupRateLimits(olderThanMs = 40 * 24 * 3600 * 1000) {
  await run("DELETE FROM rate_limits WHERE window_start < ?", now() - olderThanMs);
}

export async function peek(key: string, windowMs: number): Promise<number> {
  const windowStart = Math.floor(now() / windowMs) * windowMs;
  const rows = await all<{ count: number }>("SELECT count FROM rate_limits WHERE key = ? AND window_start = ?", key, windowStart);
  return rows[0]?.count ?? 0;
}
