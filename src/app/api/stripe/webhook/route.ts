import { getEnv } from "@/lib/env";
import { handleStripeEvent, type StripeEvent } from "@/lib/billing";
import { verifyStripeSignature } from "@/lib/stripe";

export async function POST(req: Request) {
  const secret = getEnv().STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response("Webhook no configurado", { status: 503 });
  const raw = await req.text(); // el cuerpo sin tocar: la firma se calcula sobre él
  if (!(await verifyStripeSignature(raw, req.headers.get("stripe-signature"), secret))) return new Response("Firma no válida", { status: 400 });
  let event: StripeEvent;
  try {
    event = JSON.parse(raw) as StripeEvent;
  } catch {
    return new Response("JSON no válido", { status: 400 });
  }
  try {
    const result = await handleStripeEvent(event);
    return Response.json({ received: true, result });
  } catch (e) {
    console.error("Webhook de Stripe falló", event.id, e);
    return new Response("Error procesando el evento", { status: 500 }); // Stripe reintenta
  }
}
