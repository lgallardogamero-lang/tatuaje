import { one, run, now } from "./db";
import { newId } from "./ids";
import { ASSET_PRODUCTS, CREDIT_PACKS, STUDIO_PLANS, type AssetKind, type StudioPlan } from "./config";
import { addPurchaseCredits, spend } from "./credits";

const RETENTION_PAID_MS = 30 * 86400_000;

/** Concede el derecho de descarga y alarga la retención del resultado comprado. */
export async function grantEntitlement(userId: string, jobId: string, kind: AssetKind): Promise<void> {
  const job = await one<{ id: string }>("SELECT id FROM jobs WHERE id = ? AND user_id = ?", jobId, userId);
  if (!job) throw new Error("Trabajo no encontrado");
  await run("INSERT OR IGNORE INTO entitlements (id, user_id, job_id, kind, created_at) VALUES (?, ?, ?, ?, ?)", newId(), userId, jobId, kind, now());
  await run("UPDATE jobs SET expires_at = MAX(expires_at, ?) WHERE id = ?", now() + RETENTION_PAID_MS, jobId);
}

export async function hasEntitlement(jobId: string, kind: AssetKind): Promise<boolean> {
  return Boolean(await one("SELECT 1 FROM entitlements WHERE job_id = ? AND kind = ?", jobId, kind));
}

/** Compra con créditos: cobra y concede en el mismo flujo; reintentar no cobra dos veces. */
export async function unlockWithCredits(userId: string, jobId: string, kind: AssetKind): Promise<"ok" | "already" | "no_credits"> {
  if (await hasEntitlement(jobId, kind)) return "already";
  const job = await one<{ status: string }>("SELECT status FROM jobs WHERE id = ? AND user_id = ?", jobId, userId);
  if (!job || job.status !== "done") throw new Error("El resultado aún no está listo");
  const ok = await spend(userId, ASSET_PRODUCTS[kind].credits, "asset_purchase", `${jobId}:${kind}`, jobId);
  if (!ok) return "no_credits";
  await grantEntitlement(userId, jobId, kind);
  return "ok";
}

export interface StripeEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

type Meta = Record<string, string | undefined>;

/**
 * Procesa un evento de Stripe. Cada efecto es idempotente por sí mismo (referencias únicas),
 * y además se registra el evento para descartar reenvíos.
 */
export async function handleStripeEvent(ev: StripeEvent): Promise<"processed" | "duplicate" | "ignored"> {
  if (await one("SELECT 1 FROM stripe_events WHERE event_id = ?", ev.id)) return "duplicate";
  const obj = ev.data.object;
  let result: "processed" | "ignored" = "ignored";

  if (ev.type === "checkout.session.completed" || ev.type === "checkout.session.async_payment_succeeded") {
    const sessionId = String(obj["id"]);
    const meta = (obj["metadata"] ?? {}) as Meta;
    const paid = obj["payment_status"] === "paid" || obj["mode"] === "subscription";
    const userId = (obj["client_reference_id"] as string | null) ?? meta["userId"];
    if (paid && userId) {
      if (meta["kind"] === "credits") {
        const pack = CREDIT_PACKS.find((p) => p.id === meta["packId"]);
        if (pack) {
          await addPurchaseCredits(userId, pack.credits, sessionId);
          result = "processed";
        }
      } else if (meta["kind"] === "asset" && meta["jobId"] && (meta["assetKind"] === "hd" || meta["assetKind"] === "stencil")) {
        await grantEntitlement(userId, meta["jobId"], meta["assetKind"]);
        result = "processed";
      } else if (meta["kind"] === "subscription" && meta["orgId"] && meta["plan"] && meta["plan"] in STUDIO_PLANS) {
        const plan = STUDIO_PLANS[meta["plan"] as StudioPlan];
        await run(
          `UPDATE organizations SET plan = ?, subscription_status = 'active', monthly_quota = ?, stripe_customer_id = ?, stripe_subscription_id = ?,
           listed = CASE WHEN ? = 'premium' THEN 1 ELSE listed END, featured = CASE WHEN ? = 'premium' THEN 1 ELSE featured END WHERE id = ?`,
          meta["plan"],
          plan.quota,
          (obj["customer"] as string | null) ?? null,
          (obj["subscription"] as string | null) ?? null,
          meta["plan"],
          meta["plan"],
          meta["orgId"],
        );
        result = "processed";
      }
      await run("UPDATE purchases SET status = 'paid' WHERE stripe_session_id = ?", sessionId);
    }
  } else if (ev.type === "customer.subscription.deleted" || ev.type === "customer.subscription.updated" || ev.type === "invoice.payment_failed") {
    const subId = String(ev.type === "invoice.payment_failed" ? (obj["subscription"] ?? "") : obj["id"]);
    if (subId) {
      const status = ev.type === "customer.subscription.deleted" ? "canceled" : ev.type === "invoice.payment_failed" ? "past_due" : String(obj["status"] ?? "active");
      await run(
        "UPDATE organizations SET subscription_status = ?, plan = CASE WHEN ? = 'canceled' THEN 'none' ELSE plan END, monthly_quota = CASE WHEN ? = 'canceled' THEN 0 ELSE monthly_quota END WHERE stripe_subscription_id = ?",
        status,
        status,
        status,
        subId,
      );
      result = "processed";
    }
  } else if (ev.type === "charge.refunded" || ev.type === "checkout.session.expired") {
    const sessionId = String(obj["id"]);
    if (ev.type === "checkout.session.expired") await run("UPDATE purchases SET status = 'failed' WHERE stripe_session_id = ? AND status = 'pending'", sessionId);
  }

  await run("INSERT OR IGNORE INTO stripe_events (event_id, type, received_at) VALUES (?, ?, ?)", ev.id, ev.type, now());
  return result;
}

export async function recordPendingPurchase(userId: string, product: string, amountCents: number, sessionId: string, meta: Meta) {
  await run(
    "INSERT OR IGNORE INTO purchases (id, user_id, product, amount_cents, stripe_session_id, status, meta, created_at) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)",
    newId(),
    userId,
    product,
    amountCents,
    sessionId,
    JSON.stringify(meta),
    now(),
  );
}
