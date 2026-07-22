"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Product } from "@/lib/types";
import { ProductCard } from "@/components/ProductCard";
import { Link } from "@/i18n/navigation";

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

export default function AccountFavoritesPage() {
  const t = useTranslations("account");
  const tCart = useTranslations("cart");
  const locale = useLocale();
  const token = useAuth((state) => state.token);
  const [products, setProducts] = useState<Product[] | null>(null);

  const reload = useCallback(async () => {
    if (!token) return;
    
    try {
      const response = await apiGet<{ data: Product[] }>("/account/favorites", { token, locale, revalidate: false });
      setProducts(response.data);
    } catch {
      setProducts([]);
    }
  }, [token, locale]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (products === null) {
    return null;
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.4}
          aria-hidden="true"
          className="h-20 w-20 text-line-strong"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
        <p className="text-muted">{t("noFavorites")}</p>
        <Link
          href="/catalog"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-ink px-6 py-3.5 text-sm font-medium text-white transition hover:bg-ink-hover"
        >
          {tCart("goToCatalog")}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-baseline gap-3 mb-[22px]">
        <h1 className="font-display text-[28px] font-bold text-ink m-0 tracking-tight">
          {t("favorites")}
        </h1>
        <span className="text-[15px] text-muted">
          {products.length} {plural(products.length, "товар", "товара", "товаров")}
        </span>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-[22px] items-start">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
