'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { warehouseHref } from '@/lib/warehouse';
import NoActiveStoreWarning from '@/components/NoActiveStoreWarning';

/**
 * On-hand stock per product and warehouse.
 *
 * Read-only by design: quantities are a projection of the FIFO ledger, so the
 * only way to change them is to post a goods receipt or a write-off — that
 * way every movement leaves a trace. The link below goes to those screens.
 */

type StockRow = {
  id: number;
  product_id: number;
  stock: string | number;
  avg_cost: number | null;
  // Название переводимое (ru + kk), API отдаёт его объектом — как и в списке товаров.
  product?: { id: number; name?: { ru?: string; kk?: string } | null; code?: string | null; article?: string | null } | null;
  store?: { id: number; name: string } | null;
};

export default function StockPage() {
  const [rows, setRows] = useState<StockRow[]>([]);
  const [search, setSearch] = useState('');
  const [onlyLow, setOnlyLow] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasActiveStore, setHasActiveStore] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStock = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string> = { page: page.toString() };
      if (search) params['filter[search]'] = search;
      if (onlyLow) params['filter[low]'] = '0';

      const res = await api.get('/admin/stock', { params });
      const json = res.data;
      setRows(json.data || []);
      setTotalPages(json.last_page || 1);
      setTotal(json.total || 0);
      setHasActiveStore(json.meta?.has_active_store ?? null);
    } catch (err) {
      console.error('Failed to fetch stock', err);
    } finally {
      setIsLoading(false);
    }
  }, [page, search, onlyLow]);

  useEffect(() => {
    const t = setTimeout(fetchStock, 300);
    return () => clearTimeout(t);
  }, [fetchStock]);

  const money = (kopecks: number | null) =>
    kopecks === null ? '—' : `${(kopecks / 100).toLocaleString('ru-RU')} ₸`;

  return (
    <div>
      <div className="space-y-6">
        {total > 0 && <p className="text-sm text-zinc-500">{total} позиций</p>}

        <NoActiveStoreWarning hasActiveStore={hasActiveStore} />

        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl px-4 py-3">
          Остаток нельзя отредактировать вручную — он считается по складскому журналу.
          Чтобы изменить его, проведите приёмку или списание.
        </div>

        <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Поиск по названию, коду или артикулу..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full px-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 px-2 select-none">
            <input
              type="checkbox"
              checked={onlyLow}
              onChange={(e) => { setOnlyLow(e.target.checked); setPage(1); }}
              className="h-4 w-4 rounded border-gray-300"
            />
            Только закончившиеся
          </label>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-100 text-gray-500 uppercase tracking-wider text-xs font-semibold">
                  <th className="px-6 py-4">Товар</th>
                  <th className="px-6 py-4">Склад</th>
                  <th className="px-6 py-4 text-right">Остаток</th>
                  <th className="px-6 py-4 text-right">Себестоимость</th>
                  <th className="px-6 py-4 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-blue-600 border-r-transparent" />
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      Ничего не найдено. Остатки появляются после проведения приёмки.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const qty = Number(row.stock);
                    return (
                      <tr key={row.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900">{row.product?.name?.ru || `#${row.product_id}`}</div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {row.product?.article || row.product?.code || '—'}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-700">{row.store?.name || '—'}</td>
                        <td className="px-6 py-4 text-right">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                            qty > 0
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : 'bg-red-50 text-red-700 border-red-200'
                          }`}>
                            {qty.toLocaleString('ru-RU')}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-gray-700">{money(row.avg_cost)}</td>
                        <td className="px-6 py-4 text-right">
                          <Link
                            href={`${warehouseHref.movements}?product_id=${row.product_id}${row.store ? `&store_id=${row.store.id}` : ''}`}
                            className="text-sm font-medium text-blue-600 hover:text-blue-800"
                          >
                            Движения
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="bg-gray-50 px-6 py-3 border-t border-gray-100 flex items-center justify-between">
              <span className="text-sm text-gray-500">
                Страница <span className="font-medium text-gray-900">{page}</span> из <span className="font-medium text-gray-900">{totalPages}</span>
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-md text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Назад
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-md text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Вперёд
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
