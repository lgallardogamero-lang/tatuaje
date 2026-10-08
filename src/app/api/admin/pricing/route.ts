import { requireAdmin } from "@/lib/auth";
import { handle, json, readJson } from "@/lib/api";
import { logAdmin } from "@/lib/admin";
import { getPricing, pricingSchema, resetPricing, savePricing } from "@/lib/pricing";

export const GET = handle(async () => {
  await requireAdmin();
  return json(await getPricing());
});

export const PUT = handle(async (req) => {
  const admin = await requireAdmin();
  const before = await getPricing();
  const next = pricingSchema.parse(await readJson(req));
  await savePricing(next);
  await logAdmin(admin, "pricing.update", undefined, { before, after: next });
  return json({ ok: true });
});

export const DELETE = handle(async () => {
  const admin = await requireAdmin();
  await resetPricing();
  await logAdmin(admin, "pricing.reset");
  return json({ ok: true });
});
