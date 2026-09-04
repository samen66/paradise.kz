import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Product } from '@/lib/types';

export interface B2BCartItem {
  product: Product;
  quantity: number;
}

interface B2BCartState {
  items: B2BCartItem[];
  addItem: (product: Product, quantity: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  removeItem: (productId: number) => void;
  clearCart: () => void;
  getTotal: () => number;
}

export const useB2bCart = create<B2BCartState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (product, quantity) => set((state) => {
        const existing = state.items.find(i => i.product.id === product.id);
        if (existing) {
          return {
            items: state.items.map(i => 
              i.product.id === product.id ? { ...i, quantity: i.quantity + quantity } : i
            )
          };
        }
        return { items: [...state.items, { product, quantity }] };
      }),
      updateQuantity: (productId, quantity) => set((state) => ({
        items: state.items.map(i => (i.product.id === productId ? { ...i, quantity } : i))
      })),
      removeItem: (productId) => set((state) => ({
        items: state.items.filter(i => i.product.id !== productId)
      })),
      clearCart: () => set({ items: [] }),
      getTotal: () => {
        return get().items.reduce((total, item) => total + (item?.product?.price || 0) * item.quantity, 0);
      }
    }),
    { name: 'paradise-b2b-cart' }
  )
);
