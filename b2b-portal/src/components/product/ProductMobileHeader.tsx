"use client";

import { useTranslations } from "next-intl";
import type { Product } from "@/lib/types";
import { StarRating } from "@/components/StarRating";

export function ProductMobileHeader({ product }: { product: Product }) {
  const t = useTranslations("product");
  const brandName = product.brand?.name ?? null;


  return (
    <div className="lg:hidden mb-4">
      <div className="text-xs text-muted uppercase tracking-wider mb-1">
        {product.article ? `${t("article")} ${product.article}` : null}
        {brandName ? ` · ${brandName}` : null}
      </div>
      
      <h1 className="text-xl sm:text-2xl font-bold text-ink leading-snug">
        {product.name}
      </h1>
      

    </div>
  );
}
