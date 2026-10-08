import type { MetadataRoute } from "next";
import { getEnv } from "@/lib/env";
import { directory } from "@/lib/studio";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getEnv().APP_URL.replace(/\/$/, "");
  const pages = ["", "/crear", "/estudios", "/directorio", "/privacidad", "/terminos", "/cookies", "/aviso-legal"];
  const cities = await directory().then((d) => d.cities).catch(() => []);
  return [
    ...pages.map((p) => ({ url: `${base}${p}`, changeFrequency: "monthly" as const, priority: p === "" ? 1 : 0.6 })),
    ...cities.map((c) => ({ url: `${base}/directorio/${c.slug}`, changeFrequency: "weekly" as const, priority: 0.5 })),
  ];
}
