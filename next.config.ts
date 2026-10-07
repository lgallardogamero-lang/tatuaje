import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: { unoptimized: true },
};

// Expone D1/R2/Queues locales (miniflare) durante `next dev`.
initOpenNextCloudflareForDev();

export default nextConfig;
