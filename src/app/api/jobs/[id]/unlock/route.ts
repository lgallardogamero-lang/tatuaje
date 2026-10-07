import { z } from "zod";
import { HttpError, requireUser } from "@/lib/auth";
import { handle, json, readJson } from "@/lib/api";
import { getJob } from "@/lib/jobs";
import { unlockWithCredits, recordPendingPurchase } from "@/lib/billing";
import { ASSET_PRODUCTS } from "@/lib/config";
import { createCheckout, stripeEnabled } from "@/lib/stripe";
import { balance } from "@/lib/credits";

const body = z.object({ kind: z.enum(["hd", "stencil"]), method: z.enum(["credits", "card"]) });

export const POST = handle(async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const { kind, method } = body.parse(await readJson(req));
  const job = await getJob(id!, user.id);
  if (!job || job.status !== "done") throw new HttpError(404, "El resultado no está disponible");
  const product = ASSET_PRODUCTS[kind];

  if (method === "credits") {
    const r = await unlockWithCredits(user.id, job.id, kind);
    if (r === "no_credits") return json({ error: "No tienes créditos suficientes", code: "no_credits", needed: product.credits, balance: await balance(user.id) }, 402);
    return json({ ok: true });
  }
  if (!stripeEnabled()) throw new HttpError(503, "Los pagos con tarjeta aún no están activados");
  const s = await createCheckout({
    mode: "payment",
    email: user.email,
    userId: user.id,
    name: product.label,
    amountCents: product.priceCents,
    metadata: { kind: "asset", jobId: job.id, assetKind: kind },
    successPath: `/crear/${job.id}?pago=ok`,
    cancelPath: `/crear/${job.id}`,
  });
  await recordPendingPurchase(user.id, `asset:${kind}`, product.priceCents, s.id, { jobId: job.id });
  return json({ url: s.url });
});
