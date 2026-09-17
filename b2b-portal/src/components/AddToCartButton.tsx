"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useCart } from "@/lib/cart";
import { maxQuantityFor, useB2bCart } from "@/stores/useB2bCart";
import type { Product } from "@/lib/types";

export function AddToCartButton({ product, compact = false, isB2B = false }: { product: Product; compact?: boolean; isB2B?: boolean }) {
  const t = useTranslations("common");
  const retailAdd = useCart((state) => state.add);
  const b2bAdd = useB2bCart((state) => state.addItem);
  const b2bUpdate = useB2bCart((state) => state.updateQuantity);
  const b2bRemove = useB2bCart((state) => state.removeItem);
  const inB2bCart = useB2bCart((state) => state.items.find((item) => item.product?.id === product.id)?.quantity ?? 0);
  const [justAdded, setJustAdded] = useState(false);
  const [limitNotice, setLimitNotice] = useState<string | null>(null);

  if (!product.in_stock) {
    return null;
  }

  const b2bMax = isB2B ? maxQuantityFor(product) : null;
  const b2bFull = b2bMax !== null && inB2bCart >= b2bMax;

  function handleAdd() {
    if (isB2B) {
      // The first add must reach the minimum order; later adds go one by one.
      const step = inB2bCart === 0 ? (product.b2b_min_order_qty ?? 1) : 1;
      const result = b2bAdd(product, step);

      if (result.status !== "added") {
        setLimitNotice(result.status === "limit" ? t("allInCart") : t("maxInCart", { count: result.max }));
        setTimeout(() => setLimitNotice(null), 2500);
        if (result.status === "limit") {
          return;
        }
      }
    } else {
      retailAdd({
        productId: product.id,
        slug: product.slug,
        name: product.name,
        image: product.image,
        price: product.price,
      });
    }
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1500);
  }

  if (compact && isB2B && inB2bCart > 0) {
    const minQty = product.b2b_min_order_qty ?? 1;
    // Below the minimum order the line cannot stay — "−" removes it instead.
    const removes = inB2bCart - 1 < minQty;
    const stepperButton =
      "grid h-8 w-8 place-items-center rounded-full text-lg leading-none text-white transition hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-40";

    return (
      <span className="relative inline-flex">
        <span className="inline-flex h-10 items-center rounded-full bg-ink p-1 text-white">
          <button
            type="button"
            onClick={() => (removes ? b2bRemove(product.id) : b2bUpdate(product.id, inB2bCart - 1))}
            aria-label={removes ? t("removeFromCart") : t("removeOne")}
            title={removes ? t("removeFromCart") : t("removeOne")}
            className={stepperButton}
          >
            −
          </button>
          <span
            aria-live="polite"
            aria-label={t("inCartCount", { count: inB2bCart })}
            title={t("inCartCount", { count: inB2bCart })}
            className="min-w-7 text-center text-sm font-semibold tabular-nums"
          >
            {inB2bCart}
          </span>
          <button
            type="button"
            onClick={handleAdd}
            disabled={b2bFull}
            aria-label={b2bFull ? t("allInCart") : t("addOneMore")}
            title={b2bFull ? t("allInCart") : t("addOneMore")}
            className={stepperButton}
          >
            +
          </button>
        </span>
        {limitNotice ? (
          <span role="status" className="absolute bottom-full right-0 mb-2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1 text-xs text-white shadow">
            {limitNotice}
          </span>
        ) : null}
      </span>
    );
  }

  if (compact) {
    const label = b2bFull ? t("allInCart") : justAdded ? t("added") : t("addToCart");

    return (
      <span className="relative inline-flex">
        <button
          type="button"
          onClick={handleAdd}
          disabled={b2bFull}
          aria-label={label}
          title={label}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-white transition hover:bg-ink-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          {justAdded ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true" className="h-5 w-5">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true" className="h-5 w-5">
              <path
                d="M3 4h2l2.4 12.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L21 8H6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="9" cy="20" r="1.4" />
              <circle cx="18" cy="20" r="1.4" />
            </svg>
          )}
        </button>
        {limitNotice ? (
          <span role="status" className="absolute bottom-full right-0 mb-2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1 text-xs text-white shadow">
            {limitNotice}
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <div className="flex w-full flex-col gap-1">
      <button
        type="button"
        onClick={handleAdd}
        disabled={b2bFull}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-6 py-3.5 text-sm font-medium text-white transition hover:bg-ink-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50"
      >
        {b2bFull ? t("allInCart") : justAdded ? t("added") : t("addToCart")}
      </button>
      {limitNotice ? (
        <p role="status" className="text-center text-xs text-muted">
          {limitNotice}
        </p>
      ) : null}
    </div>
  );
}
