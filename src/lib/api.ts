import { ZodError } from "zod";
import { HttpError, assertSameOrigin } from "./auth";
import { NoCreditsError, QuotaError } from "./jobs";

export function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

type Ctx = { params: Promise<Record<string, string>> };

/** Envuelve una ruta: origen (CSRF) en métodos que cambian estado y errores con mensajes claros en español. */
export function handle(fn: (req: Request, ctx: Ctx) => Promise<Response>) {
  return async (req: Request, ctx: Ctx): Promise<Response> => {
    try {
      if (!["GET", "HEAD"].includes(req.method)) await assertSameOrigin();
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      if (e instanceof NoCreditsError) return json({ error: e.message, code: "no_credits" }, 402);
      if (e instanceof QuotaError) return json({ error: e.message, code: "quota" }, 402);
      if (e instanceof ZodError) return json({ error: e.issues[0]?.message ?? "Datos no válidos" }, 400);
      console.error("Error en la API", req.method, req.url, e);
      return json({ error: "Algo ha fallado. Inténtalo de nuevo en un momento" }, 500);
    }
  };
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "Petición no válida");
  }
}
