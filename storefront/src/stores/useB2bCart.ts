import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface B2BCartItem {
  id: number;
  qty: number;
  // Store some basic product info so the cart works offline/between fetches
  name?: string;
  price?: number;
  image?: string;
}

interface B2BCartState {
  items: B2BCartItem[];
  addItem: (id: number, qty: number, meta?: { name: string; price: number; image: string }) => void;
  updateItem: (id: number, qty: number) => void;
  removeItem: (id: number) => void;
  clearCart: () => void;
  getTotal: () => number;
}

export const useB2bCart = create<B2BCartState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (id, qty, meta) => set((state) => {
        const existing = state.items.find(i => i.id === id);
        if (existing) {
          return {
            items: state.items.map(i => 
              i.id === id ? { ...i, qty: i.qty + qty, ...meta } : i
            )
          };
        }
        return { items: [...state.items, { id, qty, ...meta }] };
      }),
      updateItem: (id, qty) => set((state) => ({
        items: state.items.map(i => (i.id === id ? { ...i, qty } : i))
      })),
      removeItem: (id) => set((state) => ({
        items: state.items.filter(i => i.id !== id)
      })),
      clearCart: () => set({ items: [] }),
      getTotal: () => {
        return get().items.reduce((total, item) => total + (item.price || 0) * item.qty, 0);
      }
    }),
    { name: 'paradise-b2b-cart' }
  )
);
