import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the production Docker image.
  output: "standalone",
  experimental: {
  },
  /**
   * Раздел «Склад» переехал под /warehouse. Старые адреса живут в закладках
   * и ссылках — ведём их на новые; строку запроса Next переносит сам.
   * `/warehouse` пока открывает остатки — «Обзор» появится в этапе 2.
   */
  async redirects() {
    return [
      { source: "/warehouse", destination: "/warehouse/stock", permanent: false },
      { source: "/stock", destination: "/warehouse/stock", permanent: false },
      { source: "/stock-movements", destination: "/warehouse/movements", permanent: false },
    ];
  },
};

export default nextConfig;
