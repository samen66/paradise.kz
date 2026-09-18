"use client";

import { useEffect, useState } from "react";
import { getEcho } from "@/lib/echo";

/** Payload of the Laravel `ProductUpdated` broadcast (App\Events\ProductUpdated). */
export interface ProductUpdatedPayload {
  id: number;
  price: number | null;
  old_price: number | null;
  /** All-warehouse aggregate — the B2B figure. */
  stock: number;
  in_stock: boolean;
  /** Stock at the warehouse a guest's catalog resolves; null when hidden by settings. */
  retail_stock: number | null;
  retail_in_stock: boolean;
}

/**
 * Subscribes to `product.{id}` over Reverb and calls `onUpdate` with every
 * change. Removes only its own listener on unmount, so a card and the product
 * page can listen to the same channel side by side.
 */
export function useProductUpdates(productId: number, onUpdate: (payload: ProductUpdatedPayload) => void): void {
  useEffect(() => {
    const echo = getEcho();
    if (!echo) return;

    const channel = echo.channel(`product.${productId}`);
    const listener = (payload: ProductUpdatedPayload) => onUpdate(payload);
    channel.listen("ProductUpdated", listener);

    return () => {
      channel.stopListening("ProductUpdated", listener);
    };
    // onUpdate is expected to only call state setters; re-subscribing on
    // every render would churn the socket.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);
}

/** Live retail stock for a catalog card, seeded from the server-rendered values. */
export function useLiveRetailStock(
  productId: number,
  initialStock: number | undefined,
  initialInStock: boolean,
): { stock: number | undefined; inStock: boolean } {
  const [stock, setStock] = useState(initialStock);
  const [inStock, setInStock] = useState(initialInStock);

  // A fresh server render (router refresh, pagination) wins over the socket.
  useEffect(() => {
    setStock(initialStock);
    setInStock(initialInStock);
  }, [initialStock, initialInStock]);

  useProductUpdates(productId, (payload) => {
    setStock(payload.retail_stock ?? undefined);
    setInStock(payload.retail_in_stock);
  });

  return { stock, inStock };
}
