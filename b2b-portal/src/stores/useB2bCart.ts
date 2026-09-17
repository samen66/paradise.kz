import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Product } from '@/lib/types';

export interface B2BCartItem {
  product: Product;
  quantity: number;
}

/**
 * What happened to an add: `added` in full, `capped` — only up to the stock
 * the cart knows about (`quantity` is the new line total), `limit` — the line
 * already holds all of it and nothing changed.
 */
export type AddToCartResult =
  | { status: 'added'; quantity: number }
  | { status: 'capped'; quantity: number; max: number }
  | { status: 'limit'; quantity: number; max: number };

interface B2BCartState {
  items: B2BCartItem[];
  addItem: (product: Product, quantity: number) => AddToCartResult;
  updateQuantity: (productId: number, quantity: number) => void;
  removeItem: (productId: number) => void;
  /** Refresh the stock the cart caps against with what the server just reported. */
  syncStock: (stockByProductId: Record<number, number>) => void;
  clearCart: () => void;
  getTotal: () => number;
}

/**
 * The most of a product the cart may hold, or null when the API did not tell
 * us (stock quantity hidden by settings). The client cap is a convenience:
 * POST /cart/validate and POST /orders enforce the stock of the chosen
 * warehouse on the server either way.
 */
export function maxQuantityFor(product: Product): number | null {
  return typeof product.stock === 'number' ? Math.max(0, Math.floor(product.stock)) : null;
}

function clamp(quantity: number, max: number | null): number {
  return max === null ? quantity : Math.min(quantity, max);
}

export const useB2bCart = create<B2BCartState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (product, quantity) => {
        const existing = get().items.find((i) => i.product?.id === product.id);
        const current = existing?.quantity ?? 0;
        const max = maxQuantityFor(product);
        const wanted = current + quantity;
        const next = clamp(wanted, max);

        if (max !== null && next <= current) {
          return { status: 'limit', quantity: current, max };
        }

        set((state) => ({
          items: existing
            ? state.items.map((i) => (i.product.id === product.id ? { product, quantity: next } : i))
            : [...state.items, { product, quantity: next }],
        }));

        return max !== null && next < wanted
          ? { status: 'capped', quantity: next, max }
          : { status: 'added', quantity: next };
      },
      updateQuantity: (productId, quantity) => set((state) => ({
        items: state.items.map((i) =>
          i.product.id === productId ? { ...i, quantity: Math.max(1, clamp(quantity, maxQuantityFor(i.product))) } : i,
        ),
      })),
      removeItem: (productId) => set((state) => ({
        items: state.items.filter(i => i.product.id !== productId)
      })),
      syncStock: (stockByProductId) => set((state) => {
        const changed = state.items.some(
          (i) => i.product && stockByProductId[i.product.id] !== undefined && i.product.stock !== stockByProductId[i.product.id],
        );

        if (!changed) {
          return state;
        }

        return {
          items: state.items.map((i) =>
            i.product && stockByProductId[i.product.id] !== undefined
              ? { ...i, product: { ...i.product, stock: stockByProductId[i.product.id] } }
              : i,
          ),
        };
      }),
      clearCart: () => set({ items: [] }),
      getTotal: () => {
        return get().items.reduce((total, item) => total + (item?.product?.price || 0) * item.quantity, 0);
      }
    }),
    { name: 'paradise-b2b-cart' }
  )
);
