import { getTranslations } from "next-intl/server";
import { apiGet } from "@/lib/api";
import type { Facets, Paginated, Product } from "@/lib/types";
import { FilterSidebar } from "./FilterSidebar";
import { SortSelect } from "./SortSelect";
import { Pagination } from "./Pagination";
import { ProductCard } from "./ProductCard";
import { ActiveFilters } from "./ActiveFilters";
import { InStockChip } from "./InStockChip";

export type CatalogSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Maps the page's ?query params onto the Laravel public API's filter syntax.
 */
export function toApiParams(
  searchParams: CatalogSearchParams,
  categorySlug?: string,
): Record<string, string | undefined> {
  const params: Record<string, string | undefined> = {
    "filter[search]": first(searchParams.q),
    "filter[brand]": first(searchParams.brand),
    "filter[price_min]": first(searchParams.price_min),
    "filter[price_max]": first(searchParams.price_max),
    "filter[in_stock]": first(searchParams.in_stock),
    sort: first(searchParams.sort),
    page: first(searchParams.page),
  };

  if (categorySlug) {
    params["filter[category]"] = categorySlug;
  }

  for (const [key, value] of Object.entries(searchParams)) {
    const match = key.match(/^attr\[(.+)]$/);
    if (match && value) {
      params[`filter[attr][${match[1]}]`] = first(value);
    }
  }

  return params;
}

export async function CatalogView({
  locale,
  searchParams,
  categorySlug,
  pathname,
  title,
  seoDescription,
}: {
  locale: string;
  searchParams: CatalogSearchParams;
  categorySlug?: string;
  pathname: string;
  title: string;
  seoDescription?: string | null;
}) {
  const t = await getTranslations("catalog");

  const [products, facets] = await Promise.all([
    apiGet<Paginated<Product>>("/public/products", {
      locale,
      revalidate: 120,
      searchParams: toApiParams(searchParams, categorySlug),
    }),
    apiGet<Facets>("/public/facets", {
      locale,
      revalidate: 300,
      searchParams: categorySlug ? { category: categorySlug } : {},
    }),
  ]);

  const plainParams = Object.fromEntries(
    Object.entries(searchParams).flatMap(([key, value]) => {
      const flat = first(value);
      return flat === undefined ? [] : [[key, flat]];
    }),
  ) as Record<string, string | undefined>;

  return (
    <div className="grid gap-8 lg:grid-cols-[260px_1fr] pb-24 lg:pb-0">
      <FilterSidebar facets={facets} />

      <div>
        <div className="mb-6">
          <div className="flex items-baseline justify-between gap-4">
            <h1 className="font-display text-2xl font-semibold text-ink sm:text-3xl">{title}</h1>
            <span className="text-sm text-muted whitespace-nowrap">{t("found", { count: products.meta.total })}</span>
          </div>
          {seoDescription ? <p className="mt-2 max-w-2xl text-sm text-muted">{seoDescription}</p> : null}
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-2">
          <InStockChip searchParams={searchParams} pathname={pathname} />
          <div className="ml-auto">
            <SortSelect />
          </div>
          <div className="w-full">
            <ActiveFilters searchParams={searchParams} pathname={pathname} />
          </div>
        </div>

        {products.data.length === 0 ? (
          <div className="rounded-2xl bg-surface py-16 text-center text-muted">{t("empty")}</div>
        ) : (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 sm:gap-6 xl:grid-cols-4">
            {products.data.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        <Pagination meta={products.meta} pathname={pathname} searchParams={plainParams} />
      </div>
    </div>
  );
}
