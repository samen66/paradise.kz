"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { Product } from "@/lib/types";

type SelectedVariant = { variantId: number | null; setVariantId: (id: number | null) => void };

const SelectedVariantContext = createContext<SelectedVariant | null>(null);

/** Первый вариант, если он в наличии, — как раньше выбирал ProductInfo. */
export function initialVariantId(product: Product): number | null {
  const first = product.variants?.[0];

  return first && first.in_stock ? first.id : null;
}

/**
 * Выбранный вариант на странице товара. Галерея и блок покупки — соседи в
 * серверной разметке страницы, поэтому выбор живёт в контексте над ними.
 */
export function SelectedVariantProvider({ initialVariantId: initial, children }: { initialVariantId: number | null; children: ReactNode }) {
  const [variantId, setVariantId] = useState(initial);

  return <SelectedVariantContext.Provider value={{ variantId, setVariantId }}>{children}</SelectedVariantContext.Provider>;
}

export function useSelectedVariant(): SelectedVariant {
  const value = useContext(SelectedVariantContext);

  if (!value) {
    throw new Error("useSelectedVariant: нет SelectedVariantProvider выше");
  }

  return value;
}
