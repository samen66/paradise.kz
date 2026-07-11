import { create } from "zustand";

export interface ToastItem {
  id: string;
  message: string;
  variant: "default" | "success" | "error";
}

interface ToastState {
  items: ToastItem[];
  add: (message: string, variant?: ToastItem["variant"]) => void;
  dismiss: (id: string) => void;
}

export const useToast = create<ToastState>((set) => ({
  items: [],
  add(message, variant = "default") {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    set((state) => ({ items: [...state.items, { id, message, variant }] }));
    setTimeout(() => {
      set((state) => ({ items: state.items.filter((t) => t.id !== id) }));
    }, 3000);
  },
  dismiss(id) {
    set((state) => ({ items: state.items.filter((t) => t.id !== id) }));
  },
}));

export function toast(message: string, variant?: ToastItem["variant"]) {
  useToast.getState().add(message, variant);
}
