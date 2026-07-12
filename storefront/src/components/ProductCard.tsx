import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatPrice, tValue } from "@/lib/format";
import type { Product } from "@/lib/types";
import { AddToCartButton } from "./AddToCartButton";
import { FavoriteButton } from "./FavoriteButton";

export async function ProductCard({ product }: { product: Product }) {
  const t = await getTranslations("common");
  const locale = await getLocale();
  const href = `/product/${product.slug ?? product.id}`;

  return (
    <article className="group flex h-full flex-col">
      <Link href={href} className="relative mb-3 block w-full aspect-square overflow-hidden rounded-2xl bg-card">
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
      </Link>

      <div className="flex items-center gap-2">
        <span className="text-lg font-semibold text-ink">{formatPrice(product.price, locale)}</span>
        {/* Product data has no old_price/discount field — never fabricate a struck price or % badge. */}
      </div>

      <Link href={href} className="mt-1 line-clamp-2 min-h-10 text-sm text-ink hover:underline">
        {tValue(product.name, locale)}
      </Link>

      {product.characteristics?.[0] ? (
        <span className="mt-2 inline-block w-fit self-start rounded-full bg-black/5 px-2.5 py-1 text-xs text-muted">
          {product.characteristics[0].value}
        </span>
      ) : null}

      <div className="mt-auto flex items-center justify-end gap-2 pt-3">
        {!product.in_stock ? (
          <span className="mr-auto text-xs text-muted">{t("outOfStock")}</span>
        ) : (
          <AddToCartButton product={product} compact />
        )}
      </div>
    </article>
  );
}
