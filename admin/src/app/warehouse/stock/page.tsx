'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import type { PageMeta } from '@/lib/crud';
import { formatTenge } from '@/lib/money';
import { plural, ru } from '@/lib/text';
import {
  formatQty,
  parseStockSort,
  parseStockStatus,
  STOCK_SORTS,
  warehouseHref,
  type StockProductRow,
  type StockProductsMeta,
} from '@/lib/warehouse';
import NoActiveStoreWarning from '@/components/NoActiveStoreWarning';
import DataTable, { type Column } from '@/components/ui/DataTable';
import EmptyState from '@/components/ui/EmptyState';
import FilterChips from '@/components/ui/FilterChips';
import { buttonLink, buttonSecondary, inputClass } from '@/components/ui/styles';
import StoreSelect from '@/components/warehouse/StoreSelect';
import StockRowActions from '@/components/warehouse/StockRowActions';
import { StockStoresLine, StockStoresTable } from '@/components/warehouse/StockStores';
import { useWarehouseSummary } from '@/components/warehouse/WarehouseSummary';

type StockBody = { data: StockProductRow[]; current_page: number; last_page: number; meta: StockProductsMeta };

const STATUS_TEXT = { ok: 'text-green-700', low: 'text-amber-700', out: 'text-red-600' } as const;
const STATUS_BADGE = { low: 'bg-amber-50 text-amber-800', out: 'bg-red-50 text-red-700' } as const;
const STATUS_LABEL = { low: 'мало', out: 'нет' } as const;

/**
 * Остатки по товару. Только чтение: остаток меняют приёмки, заказы и
 * списания через FIFO-журнал. Фильтры, сортировка и страница — в адресе.
 */
function StockView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { summary } = useWarehouseSummary();

  const search = params.get('search') ?? '';
  const storeId = params.get('store_id') ?? '';
  const productId = params.get('product_id') ?? '';
  const status = parseStockStatus(params.get('status'));
  const sort = parseStockSort(params.get('sort'));
  const page = Number(params.get('page')) || 1;

  const [draft, setDraft] = useState(search);
  const [body, setBody] = useState<StockBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // В App Router router.replace/push асинхронны: адрес (а с ним params и
  // window.location) обновляется, только когда навигация-переход
  // закоммитится, а не в момент вызова. Поэтому очередной setParam/setPage
  // строит следующий адрес не из params и не из window.location (оба —
  // снимок на момент рендера, может быть устаревшим, пока предыдущий переход
  // ещё не закоммитился), а из этого рефа: он правится синхронно, сразу же
  // при вызове, так что несколько вызовов подряд складываются независимо от
  // того, когда именно каждый переход закоммитится.
  const queryRef = useRef(params.toString());

  // Синхронизировать реф, когда адрес меняется извне (Назад/Вперёд, переход
  // по ссылке на вкладку) — но только если params действительно принёс
  // другое значение. Без этой проверки промежуточный коммит одного из двух
  // почти одновременных переходов мог бы откатить реф к уже устаревшему
  // адресу поверх более нового намерения (см. отчёт: остаточный случай).
  useEffect(() => {
    const current = params.toString();
    if (queryRef.current !== current) {
      queryRef.current = current;
    }
  }, [params]);

  const setParam = (updates: Record<string, string>) => {
    const next = new URLSearchParams(queryRef.current);
    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        next.set(key, value);
      } else {
        next.delete(key);
      }
    }
    if (!('page' in updates)) {
      next.delete('page');
    }
    queryRef.current = next.toString();
    router.replace(`${pathname}${queryRef.current ? `?${queryRef.current}` : ''}`);
  };

  // Отдельно от setParam: смена страницы кладёт запись в историю (router.push),
  // так «Назад» листает страницы списка назад, а не сразу уходит из раздела.
  const setPage = (nextPage: number) => {
    const next = new URLSearchParams(queryRef.current);
    if (nextPage > 1) {
      next.set('page', String(nextPage));
    } else {
      next.delete('page');
    }
    queryRef.current = next.toString();
    router.push(`${pathname}${queryRef.current ? `?${queryRef.current}` : ''}`);
  };

  // Поиск уходит в адрес с задержкой, чтобы не делать запрос на каждую букву.
  useEffect(() => {
    if (draft === search) {
      return;
    }
    const timer = setTimeout(() => setParam({ search: draft.trim() }), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setParam читает актуальный адрес
  }, [draft]);

  useEffect(() => {
    let cancelled = false;
    const query: Record<string, string> = { page: String(page), sort };
    if (search) query['filter[search]'] = search;
    if (storeId) query['filter[store_id]'] = storeId;
    if (productId) query['filter[product_id]'] = productId;
    if (status) query['filter[status]'] = status;

    // Fetch on URL change: the list mirrors the API, an external system.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    api
      .get<StockBody>('/admin/stock/products', { params: query })
      .then((res) => {
        if (!cancelled) {
          setBody(res.data);
          setFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [search, storeId, productId, status, sort, page, attempt]);

  const counts = body?.meta.counts;
  const rows = body?.data ?? [];
  const meta: PageMeta | null = body ? { current_page: body.current_page, last_page: body.last_page } : null;
  const hasFilters = Boolean(search || storeId || productId || status);
  const unit = (row: StockProductRow) => row.product.uom || 'шт';

  const columns: Column<StockProductRow>[] = [
    {
      key: 'product',
      header: 'Товар',
      mobile: 'title',
      render: (row) => (
        <div className="flex items-center gap-3">
          {row.product.thumb_url ? (
            <img src={row.product.thumb_url} alt="" className="h-10 w-10 shrink-0 rounded-lg border border-zinc-100 object-cover" />
          ) : (
            <span className="h-10 w-10 shrink-0 rounded-lg bg-zinc-100" aria-hidden="true" />
          )}
          <div className="min-w-0">
            <div className="font-medium text-zinc-900">
              {ru(row.product.name) || `#${row.product.id}`}
              {row.status !== 'ok' && (
                <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[row.status]}`}>
                  {STATUS_LABEL[row.status]}
                </span>
              )}
            </div>
            <div className="text-xs text-zinc-500">{row.product.article || row.product.code || '—'}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'stock',
      header: 'Остаток',
      className: 'text-right',
      mobile: 'badge',
      render: (row) => (
        <span className={`font-semibold ${STATUS_TEXT[row.status]}`}>
          {formatQty(row.stock)} {unit(row)}
        </span>
      ),
    },
    { key: 'avg', header: 'Себест. ед.', className: 'text-right', mobile: 'hidden', render: (row) => formatTenge(row.avg_cost) },
    { key: 'value', header: 'Стоимость', className: 'text-right', mobile: 'meta', render: (row) => formatTenge(row.stock_value) },
    { key: 'stores', header: '', mobile: 'meta', hideOnDesktop: true, render: (row) => <StockStoresLine stores={row.stores} /> },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      mobile: 'actions',
      render: (row) => (
        <div className="flex items-center justify-end gap-4">
          <StockRowActions
            productId={row.product.id}
            productName={ru(row.product.name) || `#${row.product.id}`}
            stock={row.stock}
            storeId={storeId ? Number(storeId) : null}
          />
          <Link href={`${warehouseHref.movements}?product_id=${row.product.id}${storeId ? `&store_id=${storeId}` : ''}`} className={buttonLink}>
            Движения
          </Link>
          <Link href={`/products/${row.product.id}`} className={buttonLink}>Открыть товар</Link>
        </div>
      ),
    },
  ];

  const productName = productId ? (rows[0] ? ru(rows[0].product.name) : `Товар #${productId}`) : '';
  const totalCount = status ? (counts?.[status] ?? 0) : (counts?.all ?? 0);

  return (
    <div className="space-y-4">
      <NoActiveStoreWarning hasActiveStore={summary?.has_active_store ?? null} />

      <div className="flex flex-col gap-3 md:flex-row">
        <input
          type="search"
          aria-label="Поиск товара"
          placeholder="Название, код или артикул"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className={`${inputClass} md:flex-1`}
        />
        <StoreSelect aria-label="Склад" emptyLabel="Все склады" className="md:max-w-64" value={storeId} onChange={(e) => setParam({ store_id: e.target.value })} />
        <select aria-label="Сортировка" className={`${inputClass} md:max-w-56`} value={sort} onChange={(e) => setParam({ sort: e.target.value === 'name' ? '' : e.target.value })}>
          {Object.entries(STOCK_SORTS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <FilterChips
        label="Статус остатка"
        value={status}
        onChange={(value) => setParam({ status: value })}
        options={[
          { value: '', label: 'Все', count: counts?.all },
          { value: 'low', label: 'Заканчивается', count: counts?.low },
          { value: 'out', label: 'Нет в наличии', count: counts?.out },
        ]}
      />

      {productId && (
        <p className="text-sm text-zinc-600">
          Товар: {productName}{' '}
          <button type="button" className={buttonLink} onClick={() => setParam({ product_id: '' })}>Показать все</button>
        </p>
      )}

      {failed ? (
        <EmptyState
          title="Не удалось загрузить остатки"
          action={<button type="button" className={buttonSecondary} onClick={() => setAttempt((n) => n + 1)}>Повторить</button>}
        />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          meta={meta}
          onPageChange={setPage}
          expandable={{
            label: 'Показать места хранения',
            canExpand: (row) => row.stores.length > 0,
            render: (row) => <StockStoresTable stores={row.stores} productName={ru(row.product.name)} />,
          }}
          empty={
            hasFilters ? (
              <EmptyState
                title="Ничего не найдено"
                action={
                  <button
                    type="button"
                    className={buttonSecondary}
                    onClick={() => {
                      setDraft('');
                      queryRef.current = '';
                      router.replace(pathname);
                    }}
                  >
                    Сбросить фильтры
                  </button>
                }
              />
            ) : (
              <EmptyState title="Товаров пока нет" hint="Заведите товар в каталоге и проведите приёмку." />
            )
          }
        />
      )}

      {body && (
        <p className="text-right text-sm text-zinc-500">
          Итого по фильтру: {totalCount} {plural(totalCount, ['позиция', 'позиции', 'позиций'])}
          {!status && <> · {formatTenge(body.meta.total_value)}</>}
        </p>
      )}
    </div>
  );
}

export default function StockPage() {
  // useSearchParams needs a Suspense boundary for the static build.
  return (
    <Suspense fallback={null}>
      <StockView />
    </Suspense>
  );
}
