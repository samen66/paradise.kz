"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import type { Product, ProductVariant } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import { StarRating } from "@/components/StarRating";
import { AddToCartButton } from "@/components/AddToCartButton";
import { FavoriteButton } from "@/components/FavoriteButton";
import { Badge } from "@/components/ui/Badge";
import { getEcho } from "@/lib/echo";

interface ProductInfoProps {
  product: Product;
  locale: string;
}

export function ProductInfo({ product, locale }: ProductInfoProps) {
  const t = useTranslations("product");
  const tCommon = useTranslations("common");

  const variants = product.variants ?? [];
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(
    variants.length > 0 && variants[0].in_stock ? variants[0].id : null
  );

  const selectedVariant = variants.find(v => v.id === selectedVariantId) || null;

  // Local state for real-time updates
  const [livePrice, setLivePrice] = useState<number | null>(product.price);
  const [liveOldPrice, setLiveOldPrice] = useState<number | null>(product.old_price ?? null);
  const [liveStock, setLiveStock] = useState<number | undefined>(product.stock);
  const [liveInStock, setLiveInStock] = useState<boolean>(product.in_stock);

  useEffect(() => {
    const echo = getEcho();
    if (!echo) return;

    const channel = echo.channel(`product.${product.id}`);
    
    channel.listen("ProductUpdated", (e: any) => {
      // e contains { id, price, old_price, stock, in_stock }
      if (e.price !== undefined) setLivePrice(e.price);
      if (e.old_price !== undefined) setLiveOldPrice(e.old_price);
      if (e.stock !== undefined) setLiveStock(e.stock);
      if (e.in_stock !== undefined) setLiveInStock(e.in_stock);
    });

    return () => {
      channel.stopListening("ProductUpdated");
      // Optionally leave the channel if no other components use it
      // echo.leaveChannel(`product.${product.id}`);
    };
  }, [product.id]);

  const discountPercent =
    liveOldPrice && livePrice && liveOldPrice > livePrice
      ? Math.round((1 - livePrice / liveOldPrice) * 100)
      : null;


  const brandName = product.brand?.name ?? null;

  // Use variant stock if selected, otherwise fallback to live product stock
  const displayStock = selectedVariant ? selectedVariant.stock : liveStock;
  const inStock = selectedVariant ? selectedVariant.in_stock : liveInStock;

  return (
    <div className="flex flex-col gap-4">
      {/* Purchase card */}
      <div className="rounded-[20px] border border-line bg-white dark:bg-card p-5 lg:p-7 shadow-[0_1px_2px_rgba(28,26,23,0.04),0_16px_40px_rgba(28,26,23,0.07)] dark:shadow-none">
        {/* Top part: Hidden on mobile (rendered in ProductMobileHeader) */}
        <div className="hidden lg:block">
          {/* Badges */}
          <div className="mb-3.5 flex gap-1.5">
            {discountPercent ? <Badge variant="sale">-{discountPercent}%</Badge> : null}
            {inStock && displayStock !== undefined ? (
              <Badge variant="mint">
                {tCommon("inStock")} — {displayStock} шт
              </Badge>
            ) : !inStock ? (
              <Badge variant="sale">Нет в наличии</Badge>
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


        </div>

        {/* Price */}
        <div className="mt-5 flex items-baseline gap-3">
          <span className="font-display text-[32px] font-bold text-ink">
            {livePrice !== null ? formatPrice(livePrice, locale) : "—"}
          </span>
          {liveOldPrice ? (
            <span className="text-[17px] text-muted line-through">
              {formatPrice(liveOldPrice, locale)}
            </span>
          ) : null}
        </div>

        {/* Variants */}
        {variants.length > 0 ? (
          <div className="mt-5">
            <div className="mb-2 text-[13px] font-semibold text-ink">{t("colorLabel")}</div>
            <div className="flex flex-wrap gap-2">
              {variants.map((v: ProductVariant) => (
                <button
                  key={v.id}
                  onClick={() => setSelectedVariantId(v.id)}
                  className={`px-3 py-1.5 text-sm rounded-full border transition ${
                    selectedVariantId === v.id
                      ? "border-ink bg-ink text-white"
                      : "border-line bg-surface text-ink hover:border-ink/50"
                  } ${!v.in_stock ? "opacity-50 line-through" : ""}`}
                >
                  {v.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* Actions */}
        <div className="mt-5 flex items-stretch gap-2.5">
          <div className="flex-1">
            {inStock ? (
              <AddToCartButton product={selectedVariant ? { ...product, id: selectedVariant.id, name: `${product.name} (${selectedVariant.name})`, price: livePrice } : { ...product, price: livePrice }} />
            ) : null}
          </div>
          <FavoriteButton productId={product.id} className="!h-12 !w-12" />
        </div>
      </div>

      {/* Delivery info card */}
      <div className="flex flex-col gap-3 rounded-[20px] border border-line bg-white dark:bg-card px-5 py-5 lg:px-7 lg:py-[22px] text-sm shadow-[0_1px_2px_rgba(28,26,23,0.04),0_12px_32px_rgba(28,26,23,0.05)] dark:shadow-none">
        <div className="grid grid-cols-2 gap-2 text-xs lg:hidden mb-1">
          <div className="flex items-center gap-1.5 text-mint-ink font-medium">
            {inStock ? (
              <>
                <span className="w-2 h-2 rounded-full bg-mint-ink animate-pulse"></span>
                В наличии {displayStock !== undefined ? `(${displayStock})` : ""}
              </>
            ) : (
              <span className="text-red-500">Нет в наличии</span>
            )}
          </div>
          <div className="text-muted text-right">
            Доставка: <span className="font-semibold text-ink">Завтра</span>
          </div>
        </div>

        <div className="hidden lg:flex justify-between gap-3">
          <span className="text-muted">{t("deliveryAlmaty")}</span>
          <span className="font-semibold text-mint-ink">{t("deliveryFree")}</span>
        </div>
        <div className="hidden lg:flex justify-between gap-3">
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

      {/* Mobile Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-card/95 backdrop-blur-md border-t border-line p-3 px-4 flex items-center justify-between z-50 lg:hidden shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
        <div>
          <span className="block text-[11px] text-muted mb-0.5">Итого:</span>
          <span className="text-lg font-bold text-ink leading-none">
            {livePrice !== null ? formatPrice(livePrice, locale) : "—"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <FavoriteButton productId={product.id} className="!h-11 !w-11" />
          <div className="min-w-[140px]">
            {inStock ? (
              <AddToCartButton product={selectedVariant ? { ...product, id: selectedVariant.id, name: `${product.name} (${selectedVariant.name})`, price: livePrice } : { ...product, price: livePrice }} />
            ) : (
              <button disabled className="w-full bg-surface text-muted text-sm font-semibold py-3 px-6 rounded-xl">
                Нет в наличии
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

