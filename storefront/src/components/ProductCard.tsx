"use client";

import { useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Link as I18nLink } from "@/i18n/navigation";
import NextLink from "next/link";
import { formatPrice, tValue } from "@/lib/format";
import type { Product } from "@/lib/types";
import { AddToCartButton } from "./AddToCartButton";
import { FavoriteButton } from "./FavoriteButton";
import { Badge } from "./ui/Badge";

export function ProductCard({ product, isB2B = false, showOverlay = true, showAddToCart = true }: { product: Product; isB2B?: boolean; showOverlay?: boolean; showAddToCart?: boolean }) {
  const locale = useLocale();
  const t = useTranslations("common");
  const outOfStockText = t("outOfStock");

  const href = isB2B ? `/b2b/product/${product.slug ?? product.id}` : `/product/${product.slug ?? product.id}`;
  const LinkComponent = isB2B ? NextLink : I18nLink;

  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const discountPercent =
    product.old_price && product.price && product.old_price > product.price
      ? Math.round((1 - product.price / product.old_price) * 100)
      : null;

  const imagesToDisplay = product.images?.length > 0 
    ? product.images.slice(0, 5) 
    : product.image ? [{ thumb: product.image, medium: product.image, full: product.image }] : [];

  return (
    <article className="group flex h-full flex-col transition-all duration-300">
      <LinkComponent 
        href={href} 
        className="relative mb-3 block w-full aspect-square overflow-hidden rounded-xl bg-card group/image"
        onMouseLeave={() => setActiveImageIndex(0)}
      >
        {showOverlay && (product.is_new || discountPercent) && (
          <div className="absolute left-3 top-3 z-20 flex flex-col gap-1.5">
            {product.is_new && <Badge variant="mint">{t("newArrival")}</Badge>}
            {discountPercent ? <Badge variant="sale">-{discountPercent}%</Badge> : null}
          </div>
        )}
        {imagesToDisplay.length > 0 ? (
          <>
            <Image
              src={imagesToDisplay[activeImageIndex].medium || imagesToDisplay[activeImageIndex].full || imagesToDisplay[activeImageIndex].thumb}
              alt={tValue(product.name, locale)}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover transition-transform duration-500 group-hover/image:scale-105"
            />
            {imagesToDisplay.length > 1 && (
              <div className="absolute inset-0 z-10 flex">
                {imagesToDisplay.map((_, idx) => (
                  <div 
                    key={idx} 
                    className="flex-1 h-full"
                    onMouseEnter={() => setActiveImageIndex(idx)}
                  />
                ))}
              </div>
            )}
            {imagesToDisplay.length > 1 && (
              <div className="absolute bottom-2 left-2 right-2 z-20 flex gap-1 opacity-0 transition-opacity duration-300 group-hover/image:opacity-100 pointer-events-none">
                {imagesToDisplay.map((_, idx) => (
                  <div 
                    key={idx} 
                    className={`h-1 flex-1 rounded-full transition-colors ${idx === activeImageIndex ? 'bg-white' : 'bg-white/50'}`}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="flex h-full items-center justify-center bg-black/5 text-muted">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-10 h-10 opacity-50">
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
            </svg>
          </div>
        )}
        {showOverlay && <FavoriteButton productId={product.id} className="absolute right-3 top-3 z-30" />}
      </LinkComponent>

      <div className="flex flex-col flex-1 px-1 pt-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-semibold text-ink">{formatPrice(product.price, locale)}</span>
            {isB2B && <span className="text-[10px] font-bold tracking-wider uppercase text-mint-ink bg-mint/40 rounded px-1.5 py-0.5">Опт</span>}
            {product.article && <span className="text-xs text-muted">{product.article}</span>}
          </div>
          
          {showAddToCart && product.in_stock && (
            <div className="flex-shrink-0">
              <AddToCartButton product={product} compact isB2B={isB2B} />
            </div>
          )}
        </div>

        {product.in_stock ? (
          product.stock !== undefined && product.stock > 0 ? (
            <div className="mt-2 text-[13px] text-green-600 font-medium">
              {t("inStock")}: {product.stock} шт.
            </div>
          ) : (
            <div className="mt-2 text-[13px] text-green-600 font-medium">
              {t("inStock")}
            </div>
          )
        ) : (
          <div className="mt-2 text-[13px] text-gray-500 font-medium">
            {outOfStockText}
          </div>
        )}

        {isB2B && (product.b2b_min_order_qty ?? 1) > 1 && (
          <span className="mt-2 inline-block w-fit bg-mint/40 text-mint-ink px-2 py-0.5 rounded-full text-[11px] font-semibold">
            Мин. заказ: {product.b2b_min_order_qty} шт.
          </span>
        )}

        <LinkComponent href={href} className="mt-2 line-clamp-2 min-h-10 text-sm text-ink hover:underline">
          {tValue(product.name, locale)}
        </LinkComponent>

        {product.characteristics?.[0] ? (
          <span className="mt-2 mb-2 inline-block w-fit self-start rounded-full bg-black/5 px-2.5 py-1 text-xs text-muted">
            {product.characteristics[0].value}
          </span>
        ) : null}
      </div>
    </article>
  );
}
