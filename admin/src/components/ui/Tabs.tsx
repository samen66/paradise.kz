'use client';

import { useState, type ReactNode } from 'react';

export type Tab = { key: string; label: string; content: ReactNode; disabled?: boolean; hint?: string };

export default function Tabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(tabs.find((t) => !t.disabled)?.key);
  const current = tabs.find((t) => t.key === active);

  return (
    <div>
      <div role="tablist" className="flex gap-1 border-b border-zinc-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={t.key === active}
            disabled={t.disabled}
            title={t.disabled ? t.hint : undefined}
            onClick={() => setActive(t.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              t.key === active ? 'border-blue-600 text-blue-700' : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="pt-4">
        {current?.content}
      </div>
    </div>
  );
}
