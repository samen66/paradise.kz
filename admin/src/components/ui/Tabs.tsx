'use client';

import { useState, type ReactNode } from 'react';

export type Tab = { key: string; label: string; content: ReactNode; disabled?: boolean; hint?: string };

/**
 * Вкладки. Ряд не переносится: на узком экране он листается вбок одной
 * строкой. Серая линия под рядом — внутренняя тень, а не `border`: активная
 * вкладка перекрывает её своей рамкой без `-mb-px`, а отрицательный отступ
 * внутри `overflow-x-auto` дал бы вертикальную полосу прокрутки.
 */
export default function Tabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(tabs.find((t) => !t.disabled)?.key);
  const current = tabs.find((t) => t.key === active);

  return (
    <div>
      <div role="tablist" className="no-scrollbar flex gap-1 overflow-x-auto shadow-[inset_0_-1px_0_var(--color-zinc-200)]">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={t.key === active}
            disabled={t.disabled}
            title={t.disabled ? t.hint : undefined}
            onClick={() => setActive(t.key)}
            className={`shrink-0 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 md:py-2 ${
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
