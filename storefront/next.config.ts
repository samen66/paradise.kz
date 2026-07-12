import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Self-contained server bundle for the production Docker image.
  output: "standalone",
  devIndicators: false,
  images: {
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== "production",
    // Product images come from the Laravel media library (local disk in dev,
    // S3 in production) — allow both.
    remotePatterns: [
      { protocol: "http", hostname: "localhost", port: "8000" },
      { protocol: "http", hostname: "127.0.0.1", port: "8000" },
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default withNextIntl(nextConfig);
