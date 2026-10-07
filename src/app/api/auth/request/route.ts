import { z } from "zod";
import { HttpError, clientIp, requestMagicLink } from "@/lib/auth";
import { handle, json, readJson } from "@/lib/api";
import { verifyTurnstile } from "@/lib/turnstile";

const body = z.object({
  email: z.string().max(254),
  adult: z.literal(true, { message: "Confirma que eres mayor de edad" }),
  privacy: z.literal(true, { message: "Acepta el aviso de privacidad para continuar" }),
  turnstileToken: z.string().optional(),
});

export const POST = handle(async (req) => {
  const b = body.parse(await readJson(req));
  if (!(await verifyTurnstile(b.turnstileToken, await clientIp()))) throw new HttpError(400, "No hemos podido verificar que eres una persona. Recarga e inténtalo de nuevo");
  const r = await requestMagicLink(b.email);
  return json({ ok: true, ...r });
});
