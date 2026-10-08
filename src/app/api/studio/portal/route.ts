import { HttpError, requireUser } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { createPortalSession, stripeEnabled } from "@/lib/stripe";
import { requireMember } from "@/lib/studio";
import { one } from "@/lib/db";

/** Portal de Stripe para que el responsable cambie de plan, actualice la tarjeta, descargue facturas o cancele. */
export const POST = handle(async () => {
  const user = await requireUser();
  const m = await requireMember(user.id, true);
  if (!stripeEnabled()) throw new HttpError(503, "Los pagos aún no están activados");
  const org = await one<{ stripe_customer_id: string | null }>("SELECT stripe_customer_id FROM organizations WHERE id = ?", m.orgId);
  if (!org?.stripe_customer_id) throw new HttpError(400, "Tu estudio no tiene una suscripción de pago que gestionar");
  const s = await createPortalSession(org.stripe_customer_id, "/estudio");
  return json({ url: s.url });
});
