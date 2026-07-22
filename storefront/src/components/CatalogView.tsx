import { getTranslations } from "next-intl/server";
import { apiGet } from "@/lib/api";
import type { Facets, Paginated, Product, Category } from "@/lib/types";
import { FilterSidebar } from "./FilterSidebar";
import { SortSelect } from "./SortSelect";
import { Pagination } from "./Pagination";
import { ProductCard } from "./ProductCard";
import { ActiveFilters } from "./ActiveFilters";
import { InStockChip } from "./InStockChip";
import { Link } from "@/i18n/navigation";
import { tValue } from "@/lib/format";
import { Badge } from "./ui/Badge";
import { FavoriteButton } from "./FavoriteButton";
import { AddToCartButton } from "./AddToCartButton";

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
  subcategories,
}: {
  locale: string;
  searchParams: CatalogSearchParams;
  categorySlug?: string;
  pathname: string;
  title: string;
  seoDescription?: string | null;
  subcategories?: Category[];
}) {
  const t = await getTranslations("catalog");
  const tCommon = await getTranslations("common");

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
    <div className="grid gap-9 lg:grid-cols-[264px_1fr] pb-24 lg:pb-0">
      <FilterSidebar facets={facets} />

      <div>
        <div className="mb-6">
          <div className="flex items-baseline gap-3 flex-wrap">
            <h1 className="font-display text-2xl font-semibold text-ink sm:text-[32px] tracking-[-0.02em]">{title}</h1>
            <span className="text-[15px] text-muted whitespace-nowrap">{t("found", { count: products.meta.total })}</span>
          </div>
          {seoDescription ? <p className="mt-2 max-w-2xl text-sm text-muted">{seoDescription}</p> : null}
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-2">
          <InStockChip searchParams={searchParams} pathname={pathname} />
          {subcategories?.map((child) => (
            <Link
              key={child.id}
              href={`/catalog/${child.slug}`}
              className="rounded-full border border-line bg-white px-4 py-2 text-sm font-medium text-ink transition hover:border-ink"
            >
              {tValue(child.name, locale)}
            </Link>
          ))}
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <ActiveFilters searchParams={searchParams} pathname={pathname} />
          <div className="ml-auto min-w-[220px]">
            <SortSelect />
          </div>
        </div>

        {products.data.length === 0 ? (
          <div className="rounded-2xl bg-surface py-16 text-center text-muted">{t("empty")}</div>
        ) : (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 sm:gap-6 xl:grid-cols-4 items-start">
            {products.data.map((product) => {
              const discountPercent = product.old_price && product.price && product.old_price > product.price
                ? Math.round((1 - product.price / product.old_price) * 100)
                : null;
              
              return (
                <div key={product.id} className="relative flex flex-col gap-2.5">
                  {(product.is_new || discountPercent) && (
                    <div className="absolute left-3 top-3 z-20 flex flex-row gap-1.5 pointer-events-none">
                      {product.is_new && <Badge variant="mint">{tCommon("newArrival")}</Badge>}
                      {discountPercent ? <Badge variant="sale">-{discountPercent}%</Badge> : null}
                    </div>
                  )}
                  <FavoriteButton productId={product.id} className="absolute right-3 top-3 z-30" />
                  <ProductCard product={product} showOverlay={false} showAddToCart={false} />
                  <AddToCartButton product={product} />
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-11 flex flex-col items-center gap-2.5">
          <span className="text-[13px] text-muted">
            {t("shown", {
              shown: products.data.length,
              total: products.meta.total,
            })}
          </span>
          <Pagination meta={products.meta} pathname={pathname} searchParams={plainParams} />
        </div>
      </div>
    </div>
  );
}
