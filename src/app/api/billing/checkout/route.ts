import { z } from "zod";
import { HttpError, requireUser } from "@/lib/auth";
import { handle, json, readJson } from "@/lib/api";
import { getPricing } from "@/lib/pricing";
import { createCheckout, stripeEnabled } from "@/lib/stripe";
import { recordPendingPurchase } from "@/lib/billing";

export const POST = handle(async (req) => {
  const user = await requireUser();
  const { packId, next } = z.object({ withdrawalConsent: z.literal(true, { message: "Marca la casilla de consentimiento para poder pagar" }), packId: z.string(), next: z.string().regex(/^\/[a-z0-9/_-]*$/i).max(80).optional() }).parse(await readJson(req));
  const pack = (await getPricing()).packs.find((p) => p.id === packId);
  if (!pack) throw new HttpError(400, "Paquete no válido");
  if (!stripeEnabled()) throw new HttpError(503, "Los pagos aún no están activados");
  const back = next ?? "/cuenta";
  const s = await createCheckout({
    mode: "payment",
    email: user.email,
    userId: user.id,
    name: `${pack.credits} créditos`,
    amountCents: pack.priceCents,
    metadata: { kind: "credits", packId: pack.id },
    successPath: `${back}?pago=ok`,
    cancelPath: back,
  });
  await recordPendingPurchase(user.id, `credits:${pack.id}`, pack.priceCents, s.id, { credits: String(pack.credits), withdrawalConsentAt: new Date().toISOString() });
  return json({ url: s.url });
});
