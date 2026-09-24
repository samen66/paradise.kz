'use client';

import { useToastStore } from '@/stores/toastStore';

export default function Toaster() {
  const { toasts, dismiss } = useToastStore();

  return (
    <div
      className="fixed left-[max(1rem,env(safe-area-inset-left))] right-[max(1rem,env(safe-area-inset-right))] bottom-[calc(4.75rem_+_var(--save-bar-h,0px)_+_env(safe-area-inset-bottom))] z-[60] flex flex-col gap-2 md:left-auto md:right-4 md:w-80 lg:bottom-[calc(1rem_+_var(--save-bar-h,0px))]"
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
