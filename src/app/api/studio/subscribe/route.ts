import { z } from "zod";
import { HttpError, requireUser } from "@/lib/auth";
import { handle, json, readJson } from "@/lib/api";
import { STUDIO_PLANS } from "@/lib/config";
import { createCheckout, stripeEnabled } from "@/lib/stripe";
import { recordPendingPurchase } from "@/lib/billing";
import { requireMember } from "@/lib/studio";
import { one } from "@/lib/db";

const body = z.object({ plan: z.enum(["basic", "pro", "premium"]), withdrawalConsent: z.literal(true, { message: "Marca la casilla de consentimiento para poder pagar" }) });

/** Suscripción mensual del estudio con Stripe Checkout. El plan se activa cuando llega el webhook, no al volver de Stripe. */
export const POST = handle(async (req) => {
  const user = await requireUser();
  const m = await requireMember(user.id, true);
  const { plan } = body.parse(await readJson(req));
  if (!stripeEnabled()) throw new HttpError(503, "Los pagos aún no están activados");
  const org = await one<{ stripe_subscription_id: string | null; subscription_status: string }>("SELECT stripe_subscription_id, subscription_status FROM organizations WHERE id = ?", m.orgId);
  if (org?.stripe_subscription_id && org.subscription_status === "active") throw new HttpError(400, "Tu estudio ya tiene una suscripción activa. Para cambiar de plan usa «Gestionar suscripción»");
  const p = STUDIO_PLANS[plan];
  const s = await createCheckout({
    mode: "subscription",
    email: user.email,
    userId: user.id,
    name: `Calco para estudios: plan ${p.label}`,
    amountCents: p.priceCents,
    metadata: { kind: "subscription", orgId: m.orgId, plan, withdrawalConsentAt: new Date().toISOString() },
    successPath: "/estudio?pago=ok",
    cancelPath: "/estudio",
  });
  await recordPendingPurchase(user.id, `studio:${plan}`, p.priceCents, s.id, { orgId: m.orgId });
  return json({ url: s.url });
});
