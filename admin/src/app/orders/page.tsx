'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/ui/PageHeader';
import type { PageMeta } from '@/lib/crud';
import { inputClass } from '@/components/ui/styles';
import OrderTabs from '@/components/orders/OrderTabs';
import { orderColumns, type OrderRow } from '@/components/orders/OrdersTable';
import {
  SEGMENT_TABS,
  STATUS_TABS,
  type OrderSegment,
  type StatusCounts,
  type StatusTabKey,
} from '@/components/orders/orderStatus';

/**
 * Рабочее место менеджера по заказам.
 *
 * Состояние экрана (сегмент, статус, поиск, страница) живёт в query-параметрах,
 * а не в useState: так ссылку на «новые B2B» можно передать, F5 её не теряет и
 * «назад» в браузере работает.
 */
function OrdersScreen() {
  const router = useRouter();
  const params = useSearchParams();

  // Неизвестное значение параметра трактуем как умолчание, а не как ошибку.
  const segment: OrderSegment =
    (SEGMENT_TABS.find((t) => t.key === params.get('segment'))?.key as OrderSegment) ?? 'all';
  const status: StatusTabKey =
    (STATUS_TABS.find((t) => t.key === params.get('status'))?.key as StatusTabKey) ?? 'all';
  const query = params.get('q') ?? '';
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);

  const [rows, setRows] = useState<OrderRow[]>([]);
  const [counts, setCounts] = useState<StatusCounts | null>(null);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState(query);

  // Поле ввода — своё состояние, URL догоняет его с задержкой: иначе каждая
  // буква оставляла бы запись в истории и дёргала запрос.
  useEffect(() => {
    setDraft(query);
  }, [query]);

  const buildHref = useCallback(
    (next: { segment?: OrderSegment; status?: StatusTabKey; q?: string; page?: number }) => {
      const sp = new URLSearchParams();
      const nextSegment = next.segment ?? segment;
      const nextStatus = next.status ?? status;
      const nextQuery = next.q ?? query;
      // Смена вкладки или поиска всегда возвращает на первую страницу.
      const nextPage = next.page ?? (next.segment || next.status || next.q !== undefined ? 1 : page);

      if (nextSegment !== 'all') sp.set('segment', nextSegment);
      if (nextStatus !== 'all') sp.set('status', nextStatus);
      if (nextQuery) sp.set('q', nextQuery);
      if (nextPage > 1) sp.set('page', String(nextPage));

      const qs = sp.toString();

      return qs ? `/orders?${qs}` : '/orders';
    },
    [segment, status, query, page],
  );

  useEffect(() => {
    if (draft === query) {
      return;
    }

    const t = setTimeout(() => router.replace(buildHref({ q: draft })), 300);

    return () => clearTimeout(t);
  }, [draft, query, router, buildHref]);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const requestParams: Record<string, string> = { page: String(page) };
      if (segment !== 'all') requestParams['filter[segment]'] = segment;
      if (status !== 'all') requestParams['filter[status]'] = status;
      if (query) requestParams['filter[search]'] = query;

      const { data } = await api.get('/admin/orders', { params: requestParams });

      setRows(data.data ?? []);
      setCounts(data.meta?.status_counts ?? null);
      setMeta({ current_page: data.current_page ?? 1, last_page: data.last_page ?? 1 });
      setTotal(data.total ?? 0);
    } catch (error) {
      console.error('Не удалось загрузить заказы', error);
    } finally {
      setLoading(false);
    }
  }, [segment, status, query, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo(() => orderColumns(() => void load()), [load]);

  return (
    <div>
      <div className="space-y-4">
        <PageHeader title="Заказы" />

        <OrderTabs segment={segment} status={status} counts={counts} buildHref={buildHref} />

        <div className="flex items-center gap-4">
          <input
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Поиск по ID, номеру или телефону…"
            className={`${inputClass} max-w-md`}
          />
          <span className="text-sm text-zinc-500">{total} всего</span>
        </div>

        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          emptyText="Заказы не найдены"
          meta={meta}
          onPageChange={(next) => router.push(buildHref({ page: next }))}
        />
      </div>
    </div>
  );
}

/**
 * useSearchParams требует границы Suspense — без неё Next валит сборку
 * страницы в статическом рендере.
 */
export default function OrdersPage() {
  return (
    <Suspense fallback={<div className="p-6 text-zinc-500">Загрузка…</div>}>
      <OrdersScreen />
    </Suspense>
  );
}
