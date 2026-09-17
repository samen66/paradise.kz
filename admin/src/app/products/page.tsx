'use client';

import { useState, useEffect, useCallback } from 'react';
import { isAxiosError } from 'axios';
import Link from 'next/link';
import api from '@/lib/api';
import { serverMessage } from '@/lib/errors';
import { toast } from '@/stores/toastStore';

/**
 * Product list.
 *
 * Besides the catalog itself, this screen answers "why is this product not on
 * the site?". The backend reports an `issues` array per product — the rules
 * VisibilityService and PricingService already apply — and every code gets a
 * badge here, so a manager sees at a glance what will not reach the storefront.
 */

type Product = {
  id: number;
  name?: { ru?: string; kk?: string } | null;
  code?: string | null;
  retail_price?: number | null;
  b2b_price?: number | null;
  is_active: boolean;
  issues?: string[];
  category?: { name?: { ru?: string } | null } | null;
  media?: { original_url: string }[] | null;
};

/** Issue code → what to call it in the list. */
const ISSUE_LABELS: Record<string, string> = {
  no_price: 'Нет цены',
  no_slug: 'Нет ссылки',
  no_category: 'Без категории',
  inactive: 'Выключен',
  hidden_by_group: 'Скрыт группой',
  out_of_stock: 'Нет остатка',
};

/** Sold out is a fact of the business; the rest mean the product is set up wrongly. */
const WARNING_ISSUES = ['out_of_stock'];

/** Prices come from the API in minor units (тиын); the column shows ₸. */
const formatTenge = (kopecks: unknown): string =>
  kopecks === null || kopecks === undefined || kopecks === ''
    ? '—'
    : `₸${(Number(kopecks) / 100).toLocaleString('ru-RU', { maximumFractionDigits: 2 })}`;

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [isActive, setIsActive] = useState('');
  const [onlyBroken, setOnlyBroken] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        ...(search && { 'filter[search]': search }),
        ...(isActive && { 'filter[is_active]': isActive }),
        ...(onlyBroken && { 'filter[issues]': '1' }),
      });
      const res = await api.get(`/admin/products?${query}`);

      setProducts(res.data?.data || []);
      setTotalPages(res.data?.last_page || 1);
    } catch (error) {
      console.error('Failed to fetch products', error);
    } finally {
      setIsLoading(false);
    }
  }, [page, search, isActive, onlyBroken]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(fetchProducts, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [fetchProducts]);

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить товар?')) return;
    try {
      await api.delete(`/admin/products/${id}`);
      fetchProducts();
    } catch (error) {
      const message = serverMessage(error);

      if (message) {
        toast.error(message);
      } else if (isAxiosError(error) && error.response && error.response.status < 500 && ![401, 403].includes(error.response.status)) {
        // 401/403/5xx/network are already reported by the axios interceptor;
        // this covers the remaining 4xx that would otherwise fail silently.
        toast.error('Не удалось удалить');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Товары</h1>
            <p className="text-sm text-gray-500 mt-1">Каталог, цены и то, что мешает товару попасть на витрину.</p>
          </div>
          <Link 
            href="/products/create" 
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring bg-blue-600 text-white shadow hover:bg-blue-700 h-10 px-4 py-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
            Создать товар
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="relative flex-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input 
              type="text" 
              placeholder="Поиск по названию или коду..." 
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
          <select 
            value={isActive} 
            onChange={(e) => { setIsActive(e.target.value); setPage(1); }}
            className="w-full sm:w-48 px-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none"
          >
            <option value="">Все статусы</option>
            <option value="1">Активные</option>
            <option value="0">Выключенные</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-700 px-2 select-none whitespace-nowrap">
            <input
              type="checkbox"
              checked={onlyBroken}
              onChange={(e) => { setOnlyBroken(e.target.checked); setPage(1); }}
              className="h-4 w-4 rounded border-gray-300"
            />
            Только проблемные
          </label>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-100 text-gray-500 uppercase tracking-wider text-xs font-semibold">
                  <th className="px-6 py-4">ID</th>
                  <th className="px-6 py-4">Фото</th>
                  <th className="px-6 py-4">Название и код</th>
                  <th className="px-6 py-4">Категория</th>
                  <th className="px-6 py-4">Цены</th>
                  <th className="px-6 py-4">Статус</th>
                  <th className="px-6 py-4">Проблемы</th>
                  <th className="px-6 py-4 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                      <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-blue-600 border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
                      <p className="mt-2">Загрузка товаров...</p>
                    </td>
                  </tr>
                ) : products.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-gray-300 mb-3"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
                      <p>Товары не найдены.</p>
                    </td>
                  </tr>
                ) : (
                  products.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-4 text-gray-500 font-medium">#{p.id}</td>
                      <td className="px-6 py-4">
                        {p.media && p.media.length > 0 ? (
                          <img src={p.media[0].original_url} alt="" className="w-12 h-12 object-cover rounded-lg border border-gray-100 shadow-sm" />
                        ) : (
                          <div className="w-12 h-12 bg-gray-50 border border-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900 line-clamp-1">{p.name?.ru || 'Без названия'}</div>
                        <div className="text-xs text-gray-500 mt-1">{p.code || 'Без кода'}</div>
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {p.category?.name?.ru || <span className="text-gray-400 italic">—</span>}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-gray-900 font-medium">{formatTenge(p.retail_price)} <span className="text-xs text-gray-400 font-normal ml-1">Розница</span></div>
                        <div className="text-gray-600 text-sm mt-0.5">{formatTenge(p.b2b_price)} <span className="text-xs text-gray-400 font-normal ml-1">B2B</span></div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${p.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                          {p.is_active ? 'Активен' : 'Выключен'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {p.issues && p.issues.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-[14rem]">
                            {p.issues.map((issue) => (
                              <span
                                key={issue}
                                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                                  WARNING_ISSUES.includes(issue)
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : 'bg-red-50 text-red-700 border-red-200'
                                }`}
                              >
                                {ISSUE_LABELS[issue] || issue}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link href={`/products/${p.id}`} className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="Редактировать">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                          </Link>
                          <button onClick={() => handleDelete(p.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors" title="Удалить">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-gray-50 px-6 py-3 border-t border-gray-100 flex items-center justify-between">
              <span className="text-sm text-gray-500">
                Страница <span className="font-medium text-gray-900">{page}</span> из <span className="font-medium text-gray-900">{totalPages}</span>
              </span>
              <div className="flex gap-2">
                <button 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Назад
                </button>
                <button 
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
