"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { QuantityInput } from "@/components/QuantityInput";
import { maxQuantityFor, useB2bCart } from "@/stores/useB2bCart";
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
  const { items, removeItem, updateQuantity, syncStock } = useB2bCart();
  const [mounted, setMounted] = useState(false);
  const [validation, setValidation] = useState<CartValidation | null>(null);

  useEffect(() => setMounted(true), []);

  // Re-check only when what is ordered changes — not when syncStock() below
  // refreshes the stock stored on the cart lines.
  const cartKey = useMemo(
    () => items.filter((item) => item?.product).map((item) => `${item.product.id}:${item.quantity}`).join(","),
    [items],
  );

  const revalidate = useCallback(async () => {
    if (cartKey === "" || !token) {
      setValidation(null);
      return;
    }
    try {
      const response = await apiPost<{ data: CartValidation }>(
        "/cart/validate",
        {
          items: cartKey.split(",").map((pair) => {
            const [productId, quantity] = pair.split(":");
            return { product_id: Number(productId), quantity: Number(quantity) };
          }),
        },
        { token, locale: "ru" },
      );
      setValidation(response.data);
      // The warehouse may hold less than when the product was added: cap the
      // quantity steppers with what the server sees now.
      syncStock(Object.fromEntries(response.data.items.map((line) => [line.product_id, line.stock])));
    } catch {
      // The cart still renders from local data if validation is unreachable.
      setValidation(null);
    }
  }, [cartKey, token, syncStock]);

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
  // Checkout places the cart as it is, so every line must pass first — a
  // problem line is never dropped from the order silently.
  const hasProblems = validation !== null && validation.items.some((line) => !line.available);
  const canCheckout = hasAvailableItems && !hasProblems;
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
            const href = `/product/${product.id}`;
            const minQty = line?.min_qty ?? product.b2b_min_order_qty ?? 1;
            const maxQty = line ? Math.floor(line.stock) : maxQuantityFor(product);

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
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="inline-flex w-fit items-center rounded-full bg-sale px-2.5 py-1 text-xs font-medium text-sale-ink">
                        {t(`problems.${line.problem ?? "unavailable"}`)}
                        {line.problem === "insufficient_stock" ? ` — ${t("inStockOnly", { count: Math.floor(line.stock) })}` : ""}
                        {line.problem === "below_min_qty" ? ` — ${minQty} шт.` : ""}
                      </span>
                      {line.problem === "insufficient_stock" && Math.floor(line.stock) >= minQty ? (
                        <button
                          type="button"
                          onClick={() => updateQuantity(product.id, Math.floor(line.stock))}
                          className="text-xs font-medium text-ink underline underline-offset-2 hover:no-underline"
                        >
                          {t("reduceTo", { count: Math.floor(line.stock) })}
                        </button>
                      ) : null}
                      {line.problem === "below_min_qty" && line.stock >= minQty ? (
                        <button
                          type="button"
                          onClick={() => updateQuantity(product.id, minQty)}
                          className="text-xs font-medium text-ink underline underline-offset-2 hover:no-underline"
                        >
                          {t("raiseTo", { count: minQty })}
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="mt-auto flex items-center pt-3">
                    <QuantityInput
                      value={item.quantity}
                      min={minQty}
                      max={maxQty}
                      onChange={(quantity) => updateQuantity(product.id, quantity)}
                    />
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

          {hasProblems ? (
            <p role="alert" className="mt-4 text-sm font-medium text-sale">
              {t("fixBeforeCheckout")}
            </p>
          ) : null}

          <Link
            href="/checkout"
            aria-disabled={!canCheckout}
            tabIndex={canCheckout ? undefined : -1}
            className={`mt-5 w-full ${primaryCtaClasses} ${
              canCheckout ? "" : "pointer-events-none opacity-50"
            }`}
          >
            {t("checkout")}
          </Link>
        </aside>
      </div>
    </div>
  );
}
