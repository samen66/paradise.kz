"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams, usePathname } from "next/navigation";
import { apiGet } from "@/lib/api";
import type { Facets, Paginated, Product } from "@/lib/types";
import { useB2bAuth } from "@/stores/useB2bAuth";
import { useIsApproved } from "@/lib/approval";
import { FilterSidebar } from "@/components/FilterSidebar";
import { SortSelect } from "@/components/SortSelect";
import { Pagination } from "@/components/Pagination";
import { ProductCard } from "@/components/ProductCard";
import { ActiveFilters } from "@/components/ActiveFilters";
import { InStockChip } from "@/components/InStockChip";
import { toApiParams } from "@/components/CatalogView";

export function B2BCatalogView({ title, seoDescription }: { title: string; seoDescription?: string | null }) {
  const t = useTranslations("catalog");
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { token } = useB2bAuth();
  const isApproved = useIsApproved();

  const [products, setProducts] = useState<Paginated<Product> | null>(null);
  const [facets, setFacets] = useState<Facets | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Convert Next.js ReadonlyURLSearchParams to a plain Record for `toApiParams`
  const paramsRecord: Record<string, string | string[] | undefined> = {};
  searchParams.forEach((value, key) => {
    // Strip price-related filters and sorts since B2B prices are dynamic
    if (key === "price_min" || key === "price_max") return;
    if (key === "sort" && (value === "price" || value === "-price")) return;

    if (paramsRecord[key]) {
      const existing = paramsRecord[key];
      if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        paramsRecord[key] = [existing, value];
      }
    } else {
      paramsRecord[key] = value;
    }
  });

  useEffect(() => {
    if (!token) return;

    let isMounted = true;
    setIsLoading(true);

    const fetchData = async () => {
      try {
        const [productsRes, facetsRes] = await Promise.all([
          apiGet<Paginated<Product>>("/products", {
            token,
            locale: "ru",
            searchParams: toApiParams(paramsRecord),
          }),
          apiGet<Facets>("/public/facets", {
            locale: "ru",
            // Since there is no b2b category filtering right now, no categorySlug passed
          }),
        ]);

        if (isMounted) {
          setProducts(productsRes);
          setFacets(facetsRes);
        }
      } catch (error) {
        console.error("Failed to fetch B2B catalog data:", error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void fetchData();

    return () => {
      isMounted = false;
    };
  }, [token, searchParams.toString()]); // Refetch when URL params change

  const plainParams = Object.fromEntries(
    Object.entries(paramsRecord).flatMap(([key, value]) => {
      const flat = Array.isArray(value) ? value[0] : value;
      return flat === undefined ? [] : [[key, flat]];
    }),
  ) as Record<string, string | undefined>;

  if (isLoading && !products) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-ink border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!products || !facets) {
    return (
      <div className="rounded-2xl bg-surface py-16 text-center text-muted">
        Не удалось загрузить каталог.
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[260px_1fr] pb-24 lg:pb-0">
      <FilterSidebar facets={facets} isB2B={true} />

      <div>
        <div className="mb-8">
          <div className="flex items-baseline justify-between gap-4">
            <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">{title}</h1>
            <span className="text-sm font-medium text-muted whitespace-nowrap bg-white/50 px-3 py-1 rounded-full">
              {t("found", { count: products.meta.total })}
            </span>
          </div>
          {seoDescription ? <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">{seoDescription}</p> : null}
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-2">
          {isApproved && <InStockChip searchParams={paramsRecord} pathname={pathname} />}
          <div className="ml-auto">
            <SortSelect isB2B={true} />
          </div>
          <div className="w-full">
            <ActiveFilters searchParams={paramsRecord} pathname={pathname} />
          </div>
        </div>

        {products.data.length === 0 ? (
          <div className="rounded-2xl bg-surface py-16 text-center text-muted">{t("empty")}</div>
        ) : (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 sm:gap-6 xl:grid-cols-4">
            {products.data.map((product) => (
              <ProductCard key={product.id} product={product} isB2B={true} />
            ))}
          </div>
        )}

        <Pagination meta={products.meta} pathname={pathname} searchParams={plainParams} />
      </div>
    </div>
  );
}
