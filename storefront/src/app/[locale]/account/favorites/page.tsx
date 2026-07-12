"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { apiDelete, apiGet } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatPrice } from "@/lib/format";
import type { Product } from "@/lib/types";

export default function AccountFavoritesPage() {
  const t = useTranslations("account");
  const locale = useLocale();
  const token = useAuth((state) => state.token);
  const [products, setProducts] = useState<Product[] | null>(null);

  const reload = useCallback(async () => {
    if (!token) {
      return;
    }
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
    return <p className="py-12 text-center text-muted">{t("noFavorites")}</p>;
  }

  return (
    <div>
      <h2 className="mb-4 font-display text-2xl font-semibold text-ink">{t("favorites")}</h2>
      <ul className="divide-y divide-line">
        {products.map((product) => (
          <li key={product.id} className="flex items-center gap-4 py-3">
            <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-card">
              {product.image ? (
                <Image src={product.image} alt={product.name} fill sizes="64px" className="object-contain p-1" />
              ) : null}
            </div>
            <Link href={`/product/${product.slug ?? product.id}`} className="min-w-0 flex-1 text-sm text-ink hover:underline">
              <span className="line-clamp-2">{product.name}</span>
            </Link>
            <span className="whitespace-nowrap font-semibold text-ink">{formatPrice(product.price, locale)}</span>
            <button
              type="button"
              onClick={async () => {
                await apiDelete(`/account/favorites/${product.id}`, { token });
                await reload();
              }}
              className="text-sm text-muted transition hover:text-sale"
            >
              {t("delete")}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
