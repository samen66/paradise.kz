'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import api from '@/lib/api';
import { useResource } from '@/lib/crud';
import { formatTenge } from '@/lib/money';
import { productLabel, ru, type ProductRef } from '@/lib/text';
import { dayBoundary, documentHref, formatDateTime, formatQty, MOVEMENT_TYPES, type StockMovement } from '@/lib/warehouse';
import DataTable, { type Column } from '@/components/ui/DataTable';
import EntityPicker from '@/components/ui/EntityPicker';
import { buttonLink, buttonSecondary, inputClass } from '@/components/ui/styles';
import StoreSelect from '@/components/warehouse/StoreSelect';

const FILTERS = ['product_id', 'store_id', 'type', 'from', 'to', 'document'] as const;
type FilterKey = (typeof FILTERS)[number];

function MovementsView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const value = (key: FilterKey) => searchParams.get(key) ?? '';

  const params: Record<string, string> = {};
  for (const key of FILTERS) {
    if (!value(key)) {
      continue;
    }
    // `from`/`to` stay YYYY-MM-DD in the URL and inputs, but the request
    // sends an exact instant in the browser's own (the manager's) local
    // timezone — the API now parses a bare date in the app's UTC timezone,
    // which would shift the boundary by the manager's offset otherwise.
    params[`filter[${key}]`] =
      key === 'from' || key === 'to' ? dayBoundary(value(key), key === 'to') : value(key);
  }

  const movements = useResource<StockMovement>('/admin/stock-movements', params);
  const [productName, setProductName] = useState('');

  const productId = value('product_id');

  // Opened from /stock with only an id in the URL — show the product's name.
  useEffect(() => {
    if (!productId) {
      return;
    }
    let cancelled = false;
    api
      .get<{ data: ProductRef }>(`/admin/products/${productId}`)
      .then((res) => {
        if (!cancelled) {
          setProductName(productLabel(res.data.data));
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [productId]);

  const setFilter = (key: FilterKey, next: string) => {
    const query = new URLSearchParams(searchParams.toString());
    if (next) {
      query.set(key, next);
    } else {
      query.delete(key);
    }
    movements.setPage(1);
    router.replace(`${pathname}${query.toString() ? `?${query}` : ''}`);
  };

  const columns: Column<StockMovement>[] = [
    { key: 'date', header: 'Дата', render: (m) => formatDateTime(m.created_at) },
    { key: 'store', header: 'Склад', render: (m) => m.store?.name ?? '—' },
    {
      key: 'product',
      header: 'Товар',
      render: (m) => (
        <div>
          <div className="text-zinc-900">{ru(m.product?.name) || `#${m.product?.id}`}</div>
          {m.product?.code && <div className="text-xs text-zinc-500">{m.product.code}</div>}
        </div>
      ),
    },
    { key: 'type', header: 'Тип', render: (m) => MOVEMENT_TYPES[m.type] ?? m.type },
    {
      key: 'qty',
      header: 'Количество',
      className: 'text-right',
      render: (m) => (
        <span className={m.qty_delta >= 0 ? 'font-medium text-green-700' : 'font-medium text-red-600'}>
          {m.qty_delta >= 0 ? '+' : '−'}
          {formatQty(Math.abs(m.qty_delta))}
        </span>
      ),
    },
    { key: 'cost', header: 'Себестоимость', className: 'text-right', render: (m) => formatTenge(m.unit_cost) },
    { key: 'balance', header: 'Остаток после', className: 'text-right', render: (m) => formatQty(m.balance_after) },
    {
      key: 'document',
      header: 'Документ',
      render: (m) =>
        m.document ? (
          <Link href={documentHref(m.document)} className={buttonLink}>{m.document.label}</Link>
        ) : (
          '—'
        ),
    },
    { key: 'user', header: 'Кто', render: (m) => m.user?.name ?? '—' },
  ];

  const hasFilters = FILTERS.some((key) => value(key));

  return (
    <div>
      {hasFilters && (
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            className={buttonSecondary}
            onClick={() => {
              movements.setPage(1);
              router.replace(pathname);
              setProductName('');
            }}
          >
            Сбросить фильтры
          </button>
        </div>
      )}
      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <div className="md:col-span-2">
          {productId ? (
            <div className={`${inputClass} flex items-center justify-between gap-2`}>
              <span className="truncate">{productName || `Товар #${productId}`}</span>
              <button type="button" className={buttonLink} onClick={() => { setProductName(''); setFilter('product_id', ''); }}>×</button>
            </div>
          ) : (
            <EntityPicker<ProductRef>
              searchPath="/admin/products"
              placeholder="Товар: название или код"
              label={productLabel}
              onPick={(p) => { setProductName(productLabel(p)); setFilter('product_id', String(p.id)); }}
            />
          )}
        </div>
        <StoreSelect aria-label="Склад" emptyLabel="Все склады" value={value('store_id')} onChange={(e) => setFilter('store_id', e.target.value)} />
        <select aria-label="Тип" className={inputClass} value={value('type')} onChange={(e) => setFilter('type', e.target.value)}>
          <option value="">Все типы</option>
          {Object.entries(MOVEMENT_TYPES).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <input aria-label="С даты" type="date" className={inputClass} value={value('from')} onChange={(e) => setFilter('from', e.target.value)} />
        <input aria-label="По дату" type="date" className={inputClass} value={value('to')} onChange={(e) => setFilter('to', e.target.value)} />
      </div>
      {value('document') && (
        <p className="mb-3 text-sm text-zinc-600">
          Показаны движения одного документа.{' '}
          <button type="button" className={buttonLink} onClick={() => setFilter('document', '')}>Показать все</button>
        </p>
      )}
      <DataTable
        columns={columns}
        rows={movements.items}
        loading={movements.loading}
        meta={movements.meta}
        onPageChange={movements.setPage}
        emptyText="Движений не найдено"
      />
    </div>
  );
}

export default function StockMovementsPage() {
  // useSearchParams needs a Suspense boundary for the static build.
  return (
    <Suspense fallback={<div className="text-zinc-500">Загрузка…</div>}>
      <MovementsView />
    </Suspense>
  );
}
