"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useCart } from "@/lib/cart";
import type { Product } from "@/lib/types";

export function AddToCartButton({ product, compact = false }: { product: Product; compact?: boolean }) {
  const t = useTranslations("common");
  const add = useCart((state) => state.add);
  const [justAdded, setJustAdded] = useState(false);

  if (!product.in_stock) {
    return null;
  }

  function handleAdd() {
    add({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      image: product.image,
      price: product.price,
    });
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1500);
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleAdd}
        aria-label={justAdded ? t("added") : t("addToCart")}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-white transition hover:bg-ink-hover"
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
    );
  }

  return (
    <button
      type="button"
      onClick={handleAdd}
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-6 py-3.5 text-sm font-medium text-white transition hover:bg-ink-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50"
    >
      {justAdded ? t("added") : t("addToCart")}
    </button>
  );
}
