import { create } from 'zustand';

export type ToastKind = 'success' | 'error';

/** Кнопка в тосте: «Вернуть» после удаления строки документа. */
export type ToastAction = { label: string; onClick: () => void };

export type Toast = { id: number; kind: ToastKind; message: string; action?: ToastAction };

type ToastState = {
  toasts: Toast[];
  push: (kind: ToastKind, message: string, action?: ToastAction) => void;
  dismiss: (id: number) => void;
};

let nextId = 1;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (kind, message, action) => {
    const id = nextId++;
    set((state) => ({ toasts: [...state.toasts, { id, kind, message, action }] }));
    setTimeout(() => get().dismiss(id), 5000);
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

/** Callable from anywhere, including the axios interceptor (outside React). */
export const toast = {
  success: (message: string) => useToastStore.getState().push('success', message),
  error: (message: string) => useToastStore.getState().push('error', message),
  /** Сообщение с кнопкой отмены; живёт 5 с, как остальные. */
  undo: (message: string, action: ToastAction) => useToastStore.getState().push('success', message, action),
};
