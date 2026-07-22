"use client";

import { useTranslations } from "next-intl";
import type { Product, ProductVariant } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import { StarRating } from "@/components/StarRating";
import { AddToCartButton } from "@/components/AddToCartButton";
import { FavoriteButton } from "@/components/FavoriteButton";
import { Badge } from "@/components/ui/Badge";
import { Chip } from "@/components/ui/Chip";

interface ProductInfoProps {
  product: Product;
  locale: string;
}

export function ProductInfo({ product, locale }: ProductInfoProps) {
  const t = useTranslations("product");
  const tCommon = useTranslations("common");

  const discountPercent =
    product.old_price && product.price && product.old_price > product.price
      ? Math.round((1 - product.price / product.old_price) * 100)
      : null;

  // Mock review data — will be replaced with API data
  const ratingAvg = 4.7;
  const reviewsCount = 128;

  const variants = product.variants ?? [];
  const brandName = product.brand?.name ?? null;

  return (
    <div className="flex flex-col gap-4">
      {/* Purchase card */}
      <div className="rounded-[20px] border border-line bg-white p-7 shadow-[0_1px_2px_rgba(28,26,23,0.04),0_16px_40px_rgba(28,26,23,0.07)]">
        {/* Badges */}
        <div className="mb-3.5 flex gap-1.5">
          {discountPercent ? <Badge variant="sale">-{discountPercent}%</Badge> : null}
          {product.in_stock && product.stock !== undefined ? (
            <Badge variant="mint">
              {tCommon("inStock")} — {product.stock} шт
            </Badge>
          ) : null}
        </div>

        {/* Title */}
        <h1 className="font-display text-[26px] font-bold leading-[1.2] tracking-tight text-ink">
          {product.name}
        </h1>

        {/* Meta line */}
        <div className="mt-1.5 text-[13px] text-muted">
          {product.article ? `${t("article")} ${product.article}` : null}
          {brandName ? ` · ${brandName}` : null}
          {product.country ? ` · ${product.country}` : null}
        </div>

        {/* Rating */}
        <div className="mt-3 flex items-center gap-2">
          <StarRating rating={ratingAvg} size={18} />
          <span className="text-sm font-bold text-ink">
            {ratingAvg.toFixed(1).replace(".", ",")}
          </span>
          <a href="#reviews" className="text-[13px] text-muted no-underline hover:text-ink">
            · {t("reviewsCount", { count: reviewsCount })}
          </a>
        </div>

        {/* Price */}
        <div className="mt-5 flex items-baseline gap-3">
          <span className="font-display text-[32px] font-bold text-ink">
            {formatPrice(product.price, locale)}
          </span>
          {product.old_price ? (
            <span className="text-[17px] text-muted line-through">
              {formatPrice(product.old_price, locale)}
            </span>
          ) : null}
        </div>

        {/* Variants */}
        {variants.length > 0 ? (
          <div className="mt-5">
            <div className="mb-2 text-[13px] font-semibold text-ink">{t("colorLabel")}</div>
            <div className="flex gap-2">
              {variants.map((v: ProductVariant) => (
                <Chip key={v.id} active={v.in_stock}>
                  {v.name}
                </Chip>
              ))}
            </div>
          </div>
        ) : null}

        {/* Actions */}
        <div className="mt-5 flex items-stretch gap-2.5">
          <div className="flex-1">
            {product.in_stock ? <AddToCartButton product={product} /> : null}
          </div>
          <FavoriteButton productId={product.id} className="!h-12 !w-12" />
        </div>
      </div>

      {/* Delivery info card */}
      <div className="flex flex-col gap-3 rounded-[20px] border border-line bg-white px-7 py-[22px] text-sm shadow-[0_1px_2px_rgba(28,26,23,0.04),0_12px_32px_rgba(28,26,23,0.05)]">
        <div className="flex justify-between gap-3">
          <span className="text-muted">{t("deliveryAlmaty")}</span>
          <span className="font-semibold text-mint-ink">{t("deliveryFree")}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-muted">{t("deliveryDate")}</span>
          <span className="font-medium text-ink">Завтра</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-muted">{t("assemblyLabel")}</span>
          <span className="font-medium text-ink">{t("assemblyValue")}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-muted">{t("warranty")}</span>
          <span className="font-medium text-ink">18 месяцев</span>
        </div>
      </div>
    </div>
  );
}
