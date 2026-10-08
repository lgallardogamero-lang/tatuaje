import { z } from "zod";
import { ASSET_PRODUCTS, CREDIT_PACKS, FREE_CREDITS } from "./config";
import { one, run, now } from "./db";

/**
 * Precios y parámetros de negocio editables desde el panel de administración.
 * Se guardan en la tabla `settings`; si no hay nada guardado (o es inválido) se usan los valores de `config.ts`.
 */
export const pricingSchema = z.object({
  freeCredits: z.number().int().min(0).max(20),
  /** Coste estimado de IA por imagen generada, en céntimos de euro (para el cálculo de margen). */
  aiUnitCostCents: z.number().min(0).max(100),
  packs: z
    .array(
      z.object({
        id: z.string().regex(/^[a-z0-9]{2,20}$/, "El identificador usa 2-20 letras minúsculas o números"),
        credits: z.number().int().min(1).max(1000),
        priceCents: z.number().int().min(50).max(100_000),
        label: z.string().trim().min(1).max(40),
        highlight: z.boolean().optional(),
      }),
    )
    .min(1)
    .max(6)
    .refine((p) => new Set(p.map((x) => x.id)).size === p.length, "Hay identificadores repetidos"),
  assets: z.object({
    hd: z.object({ credits: z.number().int().min(0).max(50), priceCents: z.number().int().min(0).max(20_000), label: z.string().trim().min(1).max(60) }),
    stencil: z.object({ credits: z.number().int().min(0).max(50), priceCents: z.number().int().min(0).max(20_000), label: z.string().trim().min(1).max(60) }),
  }),
});
export type Pricing = z.infer<typeof pricingSchema>;

export const DEFAULT_PRICING: Pricing = {
  freeCredits: FREE_CREDITS,
  aiUnitCostCents: 3.2, // ≈ 0,034 $ por imagen a calidad media
  packs: CREDIT_PACKS.map((p) => ({ id: p.id, credits: p.credits, priceCents: p.priceCents, label: p.label, ...("highlight" in p ? { highlight: true } : {}) })),
  assets: { hd: { ...ASSET_PRODUCTS.hd }, stencil: { ...ASSET_PRODUCTS.stencil } },
};

export async function getPricing(): Promise<Pricing> {
  try {
    const row = await one<{ value: string }>("SELECT value FROM settings WHERE key = 'pricing'");
    if (!row) return DEFAULT_PRICING;
    const parsed = pricingSchema.safeParse(JSON.parse(row.value));
    return parsed.success ? parsed.data : DEFAULT_PRICING;
  } catch {
    return DEFAULT_PRICING;
  }
}

export async function savePricing(p: Pricing): Promise<void> {
  const clean = pricingSchema.parse(p);
  await run(
    "INSERT INTO settings (key, value, updated_at) VALUES ('pricing', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    JSON.stringify(clean),
    now(),
  );
}

export async function resetPricing(): Promise<void> {
  await run("DELETE FROM settings WHERE key = 'pricing'");
}
