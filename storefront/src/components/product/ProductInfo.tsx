"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { Product, ProductVariant } from "@/lib/types";
import { useSelectedVariant } from "./SelectedVariant";
import { formatPrice } from "@/lib/format";
import { StarRating } from "@/components/StarRating";
import { AddToCartButton } from "@/components/AddToCartButton";
import { FavoriteButton } from "@/components/FavoriteButton";
import { Badge } from "@/components/ui/Badge";
import { useProductUpdates } from "@/lib/use-live-product";
import { retailStockLabel } from "@/lib/stock";

interface ProductInfoProps {
  product: Product;
  locale: string;
  categoryName?: string | null;
}

export function ProductInfo({ product, locale, categoryName }: ProductInfoProps) {
  const t = useTranslations("product");
  const tCommon = useTranslations("common");

  const variants = product.variants ?? [];
  const { variantId: selectedVariantId, setVariantId: setSelectedVariantId } = useSelectedVariant();

  const selectedVariant = variants.find(v => v.id === selectedVariantId) || null;

  // Local state for real-time updates
  const [livePrice, setLivePrice] = useState<number | null>(product.price);
  const [liveOldPrice, setLiveOldPrice] = useState<number | null>(product.old_price ?? null);
  const [liveStock, setLiveStock] = useState<number | undefined>(product.stock);
  const [liveInStock, setLiveInStock] = useState<boolean>(product.in_stock);

  useProductUpdates(product.id, (e) => {
    setLivePrice(e.price);
    setLiveOldPrice(e.old_price);
    setLiveStock(e.retail_stock ?? undefined);
    setLiveInStock(e.retail_in_stock);
  });

  const discountPercent =
    liveOldPrice && livePrice && liveOldPrice > livePrice
      ? Math.round((1 - livePrice / liveOldPrice) * 100)
      : null;


  const brandName = product.brand?.name ?? null;

  // Use variant stock if selected, otherwise fallback to live product stock
  const displayStock = selectedVariant ? selectedVariant.stock : liveStock;
  const inStock = selectedVariant ? selectedVariant.in_stock : liveInStock;

  const showroomCount = product.showrooms?.length ?? 0;
  const reviewsCount = product.reviews_count ?? product.reviews?.length ?? 0;
  const avgRating = product.rating ?? 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Purchase card */}
      <div className="rounded-[20px] border border-line bg-white dark:bg-card p-5 lg:p-7 shadow-[0_1px_2px_rgba(28,26,23,0.04),0_16px_40px_rgba(28,26,23,0.07)] dark:shadow-none">
        {/* Top part: Hidden on mobile (rendered in ProductMobileHeader) */}
        <div className="hidden lg:block">

          {/* 1. Category + Article header line */}
          <div className="flex items-center gap-2.5 text-[11px] tracking-[0.1em] uppercase text-accent">
            {categoryName && <span>{categoryName}</span>}
            <span className="flex-1 h-px bg-line" />
            {product.article && (
              <span className="tabular-nums opacity-55 text-muted normal-case tracking-normal text-xs">
                {product.article}
              </span>
            )}
          </div>

          {/* 2. Title */}
          <h1 className="font-display text-[26px] font-bold leading-[1.2] tracking-tight text-ink mt-3">
            {product.name}
          </h1>

          {/* 3. Rating + quick links */}
          <div className="mt-2 flex items-center gap-3 text-[13px] pb-4 border-b border-line">
            {avgRating > 0 && (
              <>
                <StarRating rating={avgRating} size={14} />
                <span className="font-semibold tabular-nums text-ink">{avgRating.toFixed(1).replace(".", ",")}</span>
              </>
            )}
            {reviewsCount > 0 && (
              <a href="#reviews" className="text-accent hover:underline">
                {reviewsCount} {reviewsCount === 1 ? "отзыв" : reviewsCount < 5 ? "отзыва" : "отзывов"}
              </a>
            )}
            {reviewsCount > 0 && (
              <>
                <span className="opacity-35">·</span>
                <a href="#specs" className="text-accent hover:underline">
                  {t("characteristics")}
                </a>
              </>
            )}
            {brandName ? (
              <>
                <span className="opacity-35">·</span>
                <span className="text-muted">{brandName}</span>
              </>
            ) : null}
          </div>
        </div>

        {/* 4. Price block */}
        <div className="mt-5 flex items-end gap-3">
          <span className="font-display text-[36px] lg:text-[40px] font-bold leading-none tabular-nums text-ink">
            {livePrice !== null ? formatPrice(livePrice, locale) : "—"}
          </span>
          {liveOldPrice ? (
            <span className="text-[15px] text-muted line-through pb-1.5 tabular-nums">
              {formatPrice(liveOldPrice, locale)}
            </span>
          ) : null}
          {discountPercent ? (
            <Badge variant="sale" className="mb-1.5">−{discountPercent}%</Badge>
          ) : null}
        </div>

        {/* 5. Stock status */}
        <div className="mt-4 flex items-center gap-2.5 text-[13px]">
          {inStock ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-green-600 animate-pulse" />
              <span>
                {tCommon("inStock")}
                {displayStock !== undefined && displayStock > 0 ? (
                  <> — <span className="tabular-nums">{retailStockLabel(displayStock, {
                    many: tCommon("stockMany"),
                    pieces: (count) => tCommon("stockPieces", { count }),
                  })}</span></>
                ) : null}
              </span>
              {showroomCount > 0 && (
                <>
                  <span className="opacity-35">·</span>
                  <a href="#showrooms" className="text-accent hover:underline">
                    в {showroomCount} {showroomCount === 1 ? "шоуруме" : showroomCount < 5 ? "шоурумах" : "шоурумах"}
                  </a>
                </>
              )}
            </>
          ) : (
            <div className="w-full border border-line border-l-2 border-l-accent px-3.5 py-3">
              <div className="font-semibold text-ink text-sm">Нет на складе — привезём под заказ</div>
              <div className="text-xs text-muted mt-0.5">
                Срок изготовления 18—24 дня. Можно оформить сейчас или получить письмо, когда товар вернётся.
              </div>
            </div>
          )}
        </div>

        {/* 6. Variants (finish/color) */}
        {variants.length > 0 ? (
          <div className="mt-5">
            <div className="flex justify-between items-baseline text-[11px] tracking-[0.09em] uppercase text-muted mb-2.5">
              <span>{t("colorLabel")}</span>
              {selectedVariant && (
                <span className="normal-case tracking-normal text-[13px] text-ink opacity-90">
                  {selectedVariant.name}
                </span>
              )}
            </div>
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

        {/* 7. Actions: Add to cart + Favorite */}
        <div className="mt-5 flex items-stretch gap-2.5">
          <div className="flex-1">
            {inStock ? (
              <AddToCartButton product={selectedVariant ? { ...product, id: selectedVariant.id, name: `${product.name} (${selectedVariant.name})`, price: livePrice } : { ...product, price: livePrice }} />
            ) : null}
          </div>
          <FavoriteButton productId={product.id} className="!h-12 !w-12" />
        </div>

        {/* 8. Delivery info rows (integrated into sidebar, not separate card) */}
        <div className="mt-5 border-t border-line">
          <div className="flex justify-between items-center gap-3 py-3 border-b border-line text-[13px]">
            <span className="text-muted">{t("deliveryAlmaty")}</span>
            <span className="text-right text-ink">
              <span className="font-semibold text-green-600">{t("deliveryFree")}</span>
              {" · "}
              <span className="font-semibold">Завтра</span>
            </span>
          </div>
          <div className="flex justify-between gap-3 py-3 border-b border-line text-[13px]">
            <span className="text-muted">Самовывоз</span>
            <span className="text-right text-ink">
              Сегодня
              {showroomCount > 0 ? (
                <>
                  {" из "}
                  <a href="#showrooms" className="text-accent hover:underline">
                    {showroomCount} {showroomCount === 1 ? "шоурума" : "шоурумов"}
                  </a>
                </>
              ) : null}
            </span>
          </div>
          <div className="flex justify-between gap-3 py-3 border-b border-line text-[13px]">
            <span className="text-muted">{t("assemblyLabel")}</span>
            <span className="text-right font-medium text-ink">{t("assemblyValue")}</span>
          </div>
          <div className="flex justify-between gap-3 py-3 border-b border-line text-[13px]">
            <span className="text-muted">Оплата</span>
            <span className="text-right text-ink">Картой, Kaspi, при получении</span>
          </div>
        </div>

        {/* 9. B2B promo strip */}
        <div className="mt-4 rounded-xl bg-surface px-4 py-3 text-xs leading-relaxed">
          <span className="font-semibold text-sm text-ink">Партнёрам</span>
          {" — оптовая цена от 5 шт. "}
          <a href="/b2b" className="text-accent hover:underline font-medium">Войти как партнёр</a>
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
