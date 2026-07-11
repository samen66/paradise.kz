"use client";

import { useToast, type ToastItem } from "@/lib/toast";

const variantClasses: Record<ToastItem["variant"], string> = {
  default: "bg-ink text-white",
  success: "bg-mint-ink text-white",
  error: "bg-sale text-sale-ink",
};

export function ToastContainer() {
  const items = useToast((s) => s.items);
  const dismiss = useToast((s) => s.dismiss);

  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2" aria-live="polite">
      {items.map((item) => (
        <div
          key={item.id}
          className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium shadow-lg animate-[slide-up_0.3s_ease-out] ${variantClasses[item.variant]}`}
        >
          <span>{item.message}</span>
          <button
            type="button"
            onClick={() => dismiss(item.id)}
            aria-label="Закрыть"
            className="ml-1 opacity-70 transition hover:opacity-100"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
