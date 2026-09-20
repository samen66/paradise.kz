'use client';

import Link from 'next/link';
import {
  SEGMENT_TABS,
  STATUS_TABS,
  type OrderSegment,
  type StatusCounts,
  type StatusTabKey,
} from './orderStatus';

type Props = {
  segment: OrderSegment;
  status: StatusTabKey;
  counts: StatusCounts | null;
  buildHref: (next: { segment?: OrderSegment; status?: StatusTabKey }) => string;
};

/**
 * Два ряда вкладок: сегмент клиента и статус заказа.
 *
 * Вкладки — ссылки, а не кнопки с состоянием: так отфильтрованный список можно
 * передать ссылкой, F5 его не сбрасывает, а «назад» в браузере работает.
 * Поэтому общий ui/Tabs здесь не подходит — он держит активную вкладку в
 * useState и сам рисует панель содержимого.
 *
 * Вкладка с нулём не прячется: исчезающие вкладки ломают мышечную память.
 */
export default function OrderTabs({ segment, status, counts, buildHref }: Props) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div role="tablist" aria-label="Сегмент клиента" className="flex gap-1 border-b border-zinc-200 px-2 pt-2">
        {SEGMENT_TABS.map((tab) => (
          <Link
            key={tab.key}
            role="tab"
            aria-selected={tab.key === segment}
            href={buildHref({ segment: tab.key })}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab.key === segment ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div role="tablist" aria-label="Статус заказа" className="flex flex-wrap gap-1 px-2 py-2">
        {STATUS_TABS.map((tab) => {
          const count = counts?.[tab.key];

          return (
            <Link
              key={tab.key}
              role="tab"
              aria-selected={tab.key === status}
              href={buildHref({ status: tab.key })}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                tab.key === status ? 'bg-blue-50 font-medium text-blue-700' : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              {tab.label}
              {count !== undefined && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-xs tabular-nums ${
                    tab.key === status ? 'bg-blue-100 text-blue-700' : 'bg-zinc-100 text-zinc-500'
                  }`}
                >
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
