'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
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
 * Ряд статусов не переносится, а листается вбок: на телефоне семь вкладок в три ряда съедали пол-экрана.
 * С `md` ряд переносится, а не листается: на 1024–1210 px семь вкладок со
 * счётчиками (~870 px) не помещаются в колонку контента (~700 px), и лист
 * без переноса резал бы «Отменённые»/«Архив» без прокрутки.
 *
 * На телефоне вкладки не ниже 44 px — общее правило для интерактивных
 * элементов; активная вкладка статуса при открытии страницы (например,
 * `?status=archived`) сразу докручивается в видимую область прокручиваемого
 * ряда.
 */
export default function OrderTabs({ segment, status, counts, buildHref }: Props) {
  const activeStatusRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    // Счётчики приходят вторым запросом и раздвигают вкладки — без `counts`
    // в зависимостях догрузка задним числом сдвигала бы уже прокрученную
    // активную вкладку обратно за край ряда.
    activeStatusRef.current?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }, [status, counts]);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div role="tablist" aria-label="Сегмент клиента" className="flex gap-1 border-b border-zinc-200 px-2 pt-2">
        {SEGMENT_TABS.map((tab) => (
          <Link
            key={tab.key}
            role="tab"
            aria-selected={tab.key === segment}
            href={buildHref({ segment: tab.key })}
            className={`inline-flex min-h-11 items-center rounded-t-lg px-4 py-2 text-sm font-medium transition-colors md:min-h-0 ${
              tab.key === segment ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div
        role="tablist"
        aria-label="Статус заказа"
        className="no-scrollbar flex gap-1 overflow-x-auto px-2 py-2 md:flex-wrap md:overflow-visible"
      >
        {STATUS_TABS.map((tab) => {
          const count = counts?.[tab.key];
          const active = tab.key === status;

          return (
            <Link
              key={tab.key}
              ref={active ? activeStatusRef : undefined}
              role="tab"
              aria-selected={active}
              href={buildHref({ status: tab.key })}
              className={`inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition-colors md:min-h-0 ${
                active ? 'bg-blue-50 font-medium text-blue-700' : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              {tab.label}
              {count !== undefined && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-xs tabular-nums ${
                    active ? 'bg-blue-100 text-blue-700' : 'bg-zinc-100 text-zinc-500'
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
