"use client";

import { useEffect, useState } from "react";
import { ASSET_PRODUCTS, CREDIT_PACKS, FREE_CREDITS } from "../config";

export interface PublicPricing {
  freeCredits: number;
  packs: { id: string; credits: number; priceCents: number; label: string; highlight?: boolean }[];
  assets: { hd: { credits: number; priceCents: number; label: string }; stencil: { credits: number; priceCents: number; label: string } };
}

const FALLBACK: PublicPricing = { freeCredits: FREE_CREDITS, packs: CREDIT_PACKS.map((p) => ({ ...p })), assets: { hd: { ...ASSET_PRODUCTS.hd }, stencil: { ...ASSET_PRODUCTS.stencil } } };
let cache: PublicPricing | null = null;

/** Precios vigentes (los que cobra el servidor). Muestra los valores por defecto hasta que llegan. */
export function usePricing(): PublicPricing {
  const [p, setP] = useState<PublicPricing>(cache ?? FALLBACK);
  useEffect(() => {
    let alive = true;
    fetch("/api/pricing")
      .then((r) => (r.ok ? (r.json() as Promise<PublicPricing>) : null))
      .then((d) => {
        if (d && alive) {
          cache = d;
          setP(d);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return p;
}
