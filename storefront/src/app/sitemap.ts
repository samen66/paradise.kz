import type { MetadataRoute } from "next";
import { apiGet } from "@/lib/api";
import type { SitemapEntry } from "@/lib/types";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

function pathFor(entry: SitemapEntry): string {
  switch (entry.type) {
    case "product":
      return `/product/${entry.slug}`;
    case "category":
      return `/catalog/${entry.slug}`;
    case "page":
      return `/pages/${entry.slug}`;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let entries: SitemapEntry[] = [];

  try {
    const response = await apiGet<{ data: SitemapEntry[] }>("/public/sitemap", { revalidate: 3600 });
    entries = response.data;
  } catch {
    // An API outage should not fail the whole sitemap route.
  }

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      alternates: { languages: { ru: siteUrl, kk: `${siteUrl}/kk` } },
    },
    {
      url: `${siteUrl}/catalog`,
      alternates: { languages: { ru: `${siteUrl}/catalog`, kk: `${siteUrl}/kk/catalog` } },
    },
  ];

  return [
    ...staticEntries,
    ...entries.map((entry) => {
      const path = pathFor(entry);

      return {
        url: `${siteUrl}${path}`,
        lastModified: entry.updated_at ?? undefined,
        alternates: {
          languages: { ru: `${siteUrl}${path}`, kk: `${siteUrl}/kk${path}` },
        },
      };
    }),
  ];
}
