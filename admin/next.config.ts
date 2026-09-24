import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the production Docker image.
  output: "standalone",
  experimental: {
  },
  /**
   * Раздел «Склад» переехал под /warehouse. Старые адреса живут в закладках
   * и ссылках — ведём их на новые; строку запроса Next переносит сам.
   */
  async redirects() {
    return [
      { source: "/stock", destination: "/warehouse/stock", permanent: false },
      { source: "/stock-movements", destination: "/warehouse/movements", permanent: false },
      { source: "/goods-receipts", destination: "/warehouse/documents?kind=receipts", permanent: false },
      { source: "/goods-receipts/:id", destination: "/warehouse/receipts/:id", permanent: false },
      { source: "/write-offs", destination: "/warehouse/documents?kind=write_offs", permanent: false },
      { source: "/write-offs/:id", destination: "/warehouse/write-offs/:id", permanent: false },
      { source: "/stores", destination: "/warehouse/stores", permanent: false },
      { source: "/suppliers", destination: "/warehouse/suppliers", permanent: false },
    ];
  },
};

export default nextConfig;
