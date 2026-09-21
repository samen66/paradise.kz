'use client';

import { useToastStore } from '@/stores/toastStore';

export default function Toaster() {
  const { toasts, dismiss } = useToastStore();

  return (
    <div
      className="fixed inset-x-4 bottom-[calc(4.75rem_+_env(safe-area-inset-bottom))] z-[60] flex flex-col gap-2 md:inset-x-auto md:right-4 md:w-80 lg:bottom-4"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismiss(t.id)}
          className={`rounded-lg px-4 py-3 text-left text-sm shadow-lg ${
            t.kind === 'error' ? 'bg-red-600 text-white' : 'bg-zinc-900 text-white'
          }`}
        >
          {t.message}
        </button>
      ))}
    </div>
  );
}
