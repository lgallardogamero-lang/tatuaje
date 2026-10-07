import { getEnv } from "./env";
import { hmacHex, safeEqual } from "./ids";

/** Cliente mínimo de Stripe por fetch (el SDK oficial no es necesario en Workers). */
function form(obj: Record<string, string | number | boolean | undefined>): URLSearchParams {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) p.set(k, String(v));
  return p;
}

async function stripePost<T>(path: string, body: URLSearchParams): Promise<T> {
  const key = getEnv().STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe no está configurado");
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) throw new Error(`Stripe: ${data.error?.message ?? res.status}`);
  return data;
}

export const stripeEnabled = () => Boolean(getEnv().STRIPE_SECRET_KEY);

export interface CheckoutParams {
  mode: "payment" | "subscription";
  email: string;
  userId: string;
  name: string;
  amountCents: number;
  metadata: Record<string, string>;
  successPath: string;
  cancelPath: string;
}

export async function createCheckout(p: CheckoutParams): Promise<{ id: string; url: string }> {
  const env = getEnv();
  const body: Record<string, string | number | boolean | undefined> = {
    mode: p.mode,
    customer_email: p.email,
    client_reference_id: p.userId,
    success_url: `${env.APP_URL}${p.successPath}`,
    cancel_url: `${env.APP_URL}${p.cancelPath}`,
    "line_items[0][quantity]": 1,
    "line_items[0][price_data][currency]": "eur",
    "line_items[0][price_data][unit_amount]": p.amountCents,
    "line_items[0][price_data][product_data][name]": p.name,
    "line_items[0][price_data][tax_behavior]": "inclusive",
    locale: "es",
    billing_address_collection: "required",
  };
  if (p.mode === "subscription") body["line_items[0][price_data][recurring][interval]"] = "month";
  else body["invoice_creation[enabled]"] = true; // factura descargable en pagos únicos
  if (env.STRIPE_AUTOMATIC_TAX === "1") body["automatic_tax[enabled]"] = true;
  for (const [k, v] of Object.entries(p.metadata)) {
    body[`metadata[${k}]`] = v;
    if (p.mode === "subscription") body[`subscription_data[metadata][${k}]`] = v;
  }
  return stripePost<{ id: string; url: string }>("checkout/sessions", form(body));
}

export async function createPortalSession(customerId: string, returnPath: string): Promise<{ url: string }> {
  return stripePost("billing_portal/sessions", form({ customer: customerId, return_url: `${getEnv().APP_URL}${returnPath}` }));
}

/** Verifica `Stripe-Signature` (HMAC-SHA256 sobre `t.cuerpo`) con tolerancia de 5 minutos. */
export async function verifyStripeSignature(rawBody: string, header: string | null, secret: string, nowSec = Math.floor(Date.now() / 1000)): Promise<boolean> {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((kv) => {
      const i = kv.indexOf("=");
      return [kv.slice(0, i), kv.slice(i + 1)] as const;
    }),
  );
  const t = Number(parts["t"]);
  if (!t || Math.abs(nowSec - t) > 300) return false;
  const expected = await hmacHex(secret, `${t}.${rawBody}`);
  const candidates = header
    .split(",")
    .filter((s) => s.startsWith("v1="))
    .map((s) => s.slice(3));
  return candidates.some((c) => safeEqual(c, expected));
}
