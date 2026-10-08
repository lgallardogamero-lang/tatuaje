import { getPricing } from "@/lib/pricing";
import { json } from "@/lib/api";

/** Precios públicos (los mismos que cobra el servidor). El coste interno de IA no se expone. */
export async function GET() {
  const p = await getPricing();
  return json({ freeCredits: p.freeCredits, packs: p.packs, assets: p.assets }, 200, { "Cache-Control": "public, max-age=60" });
}
