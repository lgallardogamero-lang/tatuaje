import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  images: { unoptimized: true },
};

// Expone D1/R2/Queues locales (miniflare) durante `next dev`.
initOpenNextCloudflareForDev();

export default nextConfig;
