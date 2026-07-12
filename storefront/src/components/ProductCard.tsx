"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Link as I18nLink } from "@/i18n/navigation";
import NextLink from "next/link";
import { formatPrice, tValue } from "@/lib/format";
import type { Product } from "@/lib/types";
import { AddToCartButton } from "./AddToCartButton";
import { FavoriteButton } from "./FavoriteButton";

export function ProductCard({ product, isB2B = false }: { product: Product; isB2B?: boolean }) {
  const locale = useLocale();
  const t = useTranslations("common");
  const outOfStockText = t("outOfStock");

  const href = isB2B ? `/b2b/product/${product.slug ?? product.id}` : `/product/${product.slug ?? product.id}`;
  const LinkComponent = isB2B ? NextLink : I18nLink;

  return (
    <article className="group flex h-full flex-col rounded-2xl bg-white p-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
      <LinkComponent href={href} className="relative mb-3 block w-full aspect-square overflow-hidden rounded-xl bg-card">
        {product.image ? (
          <Image
            src={product.image}
            alt={tValue(product.name, locale)}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-contain p-4 transition-transform group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-black/5 text-muted">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-10 h-10 opacity-50">
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
            </svg>
          </div>
        )}
        <FavoriteButton productId={product.id} className="absolute right-3 top-3" />
      </LinkComponent>

      <div className="flex items-center gap-2">
        <span className="text-lg font-semibold text-ink">{formatPrice(product.price, locale)}</span>
        {isB2B && <span className="text-[10px] font-bold tracking-wider uppercase text-mint-ink bg-mint/40 rounded px-1.5 py-0.5">Опт</span>}
      </div>

      {isB2B && (product.b2b_min_order_qty ?? 1) > 1 && (
        <span className="mt-1 inline-block w-fit bg-mint/40 text-mint-ink px-2 py-0.5 rounded-full text-[11px] font-semibold">
          Мин. заказ: {product.b2b_min_order_qty} шт.
        </span>
      )}

      <LinkComponent href={href} className="mt-1 line-clamp-2 min-h-10 text-sm text-ink hover:underline">
        {tValue(product.name, locale)}
      </LinkComponent>

      {product.characteristics?.[0] ? (
        <span className="mt-2 inline-block w-fit self-start rounded-full bg-black/5 px-2.5 py-1 text-xs text-muted">
          {product.characteristics[0].value}
        </span>
      ) : null}

      <div className="mt-auto flex items-center justify-end gap-2 pt-3">
        {!product.in_stock ? (
          <span className="mr-auto text-xs text-muted">{outOfStockText}</span>
        ) : (
          <AddToCartButton product={product} compact isB2B={isB2B} />
        )}
      </div>
    </article>
  );
}
