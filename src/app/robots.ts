import type { MetadataRoute } from "next";
import { getEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const base = getEnv().APP_URL.replace(/\/$/, "");
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/admin", "/cuenta", "/estudio", "/crear/", "/entrar"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
