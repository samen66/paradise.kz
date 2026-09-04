"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useB2bCart } from "@/stores/useB2bCart";
import { useB2bAuth } from "@/stores/useB2bAuth";
import { apiPost } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import type { CartValidation } from "@/lib/types";

const pageTitleClasses =
  "mb-6 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl lg:text-[34px] leading-tight";

const primaryCtaClasses =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-ink px-6 py-3.5 text-sm font-medium text-ink-inverse transition hover:bg-ink-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

export default function B2BCartPage() {
  const t = useTranslations("cart");
  const tCheckout = useTranslations("checkout");
  const { token } = useB2bAuth();
  const { items, removeItem, updateQuantity } = useB2bCart();
  const [mounted, setMounted] = useState(false);
  const [validation, setValidation] = useState<CartValidation | null>(null);

  useEffect(() => setMounted(true), []);

  const revalidate = useCallback(async () => {
    if (items.length === 0 || !token) {
      setValidation(null);
      return;
    }
    try {
      const response = await apiPost<{ data: CartValidation }>(
        "/cart/validate",
        { items: items.filter(item => item?.product).map((item) => ({ product_id: item.product.id, quantity: item.quantity })) },
        { token, locale: "ru" },
      );
      setValidation(response.data);
    } catch {
      // The cart still renders from local data if validation is unreachable.
      setValidation(null);
    }
  }, [items, token]);

  useEffect(() => {
    if (mounted) {
      void revalidate();
    }
  }, [mounted, revalidate]);

  if (!mounted) {
    return null;
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center sm:py-24">
        <div className="mb-6 grid h-24 w-24 place-items-center rounded-full bg-panel text-5xl" aria-hidden="true">
          🛋️
        </div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl lg:text-[34px] leading-tight">
          {t("empty")}
        </h1>
        <p className="mt-2 text-base text-muted">{t("emptyText")}</p>
        <Link href="/catalog" className={`mt-8 ${primaryCtaClasses}`}>
          {t("goToCatalog")}
        </Link>
      </div>
    );
  }

  const lineByProduct = new Map(validation?.items.map((line) => [line.product_id, line]) ?? []);
  const hasAvailableItems = validation === null || validation.items.some((line) => line.available);
  const validItems = items.filter((item) => item?.product);
  const subtotal =
    validation?.subtotal ?? validItems.reduce((sum, item) => sum + (item.product?.price ?? 0) * item.quantity, 0);

  return (
    <div>
      <h1 className={pageTitleClasses}>{t("title")}</h1>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <ul className="flex flex-col gap-4">
          {validItems.map((item) => {
            const product = item.product;
            const line = lineByProduct.get(product.id);
            const price = line?.available ? line.price : product.price;
            const displayName = line?.name ?? product.name;
            const href = `/product/${product.slug ?? product.id}`;
            const minQty = product.b2b_min_order_qty ?? 1;

            return (
              <li
                key={product.id}
                className="flex gap-4 rounded-2xl border border-line bg-card p-4 sm:gap-5 sm:p-5"
              >
                <Link
                  href={href}
                  className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-card sm:h-28 sm:w-28"
                >
                  {product.image ? (
                    <Image
                      src={product.image}
                      alt={displayName}
                      fill
                      sizes="(min-width: 640px) 112px, 80px"
                      className="object-contain p-2"
                    />
                  ) : (
                    <span className="flex h-full items-center justify-center text-3xl" aria-hidden="true">
                      🛋️
                    </span>
                  )}
                </Link>

                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <Link href={href} className="line-clamp-2 text-sm text-ink hover:underline sm:text-base">
                      {displayName}
                    </Link>
                    <button
                      type="button"
                      onClick={() => removeItem(product.id)}
                      className="shrink-0 text-sm text-muted transition hover:text-sale"
                    >
                      {t("remove")}
                    </button>
                  </div>

                  <p className="mt-1 text-base font-semibold text-ink">{formatPrice(price, "ru")}</p>
                  
                  {minQty > 1 && (
                    <p className="mt-0.5 text-xs text-muted">Мин. заказ: {minQty} шт.</p>
                  )}

                  {line && !line.available ? (
                    <span className="mt-2 inline-flex w-fit items-center rounded-full bg-sale px-2.5 py-1 text-xs font-medium text-sale-ink">
                      {t(`problems.${line.problem ?? "unavailable"}`)}
                      {line.problem === "insufficient_stock" ? ` (${line.stock})` : ""}
                    </span>
                  ) : null}

                  <div className="mt-auto flex items-center pt-3">
                    <div className="inline-flex items-center rounded-full border border-line-strong bg-surface p-1">
                      <button
                        type="button"
                        aria-label="−"
                        className="grid h-8 w-8 place-items-center rounded-full text-ink transition hover:bg-panel focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50"
                        onClick={() => updateQuantity(product.id, Math.max(minQty, item.quantity - 1))}
                        disabled={item.quantity <= minQty}
                      >
                        −
                      </button>
                      <span className="min-w-8 text-center text-sm font-medium text-ink">{item.quantity}</span>
                      <button
                        type="button"
                        aria-label="+"
                        className="grid h-8 w-8 place-items-center rounded-full text-ink transition hover:bg-panel focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50"
                        onClick={() => updateQuantity(product.id, item.quantity + 1)}
                        disabled={line?.stock !== undefined && item.quantity >= line.stock}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <aside className="rounded-2xl border border-line bg-white p-5 sm:p-6 lg:sticky lg:top-[120px]">
          <div className="flex items-center justify-between text-sm text-muted">
            <span>{tCheckout("subtotal")}</span>
            <span className="text-ink">{formatPrice(subtotal, "ru")}</span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
            <span className="text-base font-medium text-ink">{t("total")}</span>
            <span className="text-xl font-semibold text-ink">{formatPrice(subtotal, "ru")}</span>
          </div>

          <Link
            href="/checkout"
            aria-disabled={!hasAvailableItems}
            className={`mt-5 w-full ${primaryCtaClasses} ${
              hasAvailableItems ? "" : "pointer-events-none opacity-50"
            }`}
          >
            {t("checkout")}
          </Link>
        </aside>
      </div>
    </div>
  );
}
