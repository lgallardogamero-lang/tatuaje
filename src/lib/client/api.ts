export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public data?: Record<string, unknown>,
  ) {
    super(message);
  }
}

/** fetch con JSON y errores legibles en español. */
export async function api<T = Record<string, unknown>>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...(rest.headers ?? {}) },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiError("No hay conexión. Comprueba tu internet e inténtalo de nuevo", 0);
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new ApiError(String(data["error"] ?? "Algo ha fallado. Inténtalo de nuevo"), res.status, data["code"] as string | undefined, data);
  return data as T;
}

/** Solo permite redirecciones internas (evita abrir redirecciones a otros sitios). */
export function safeNext(next: string | null | undefined, fallback = "/crear"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}
