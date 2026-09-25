'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import type { PickerProduct } from '@/lib/warehouse';

export type PickerQuery = {
  storeId: number | null;
  search?: string;
  categoryId?: number | null;
  recent?: boolean;
  inStock?: boolean;
  /** false — не запрашивать (список закрыт). */
  enabled?: boolean;
};

type PickerPage = { data: PickerProduct[]; current_page: number; last_page: number };

type Resolved = { storeId: number; term: string; categoryId: number | null; recent: boolean; inStock: boolean };

const paramsFor = (q: Resolved, page: number): Record<string, string | number> => {
  const params: Record<string, string | number> = { store_id: q.storeId, page };
  if (q.term) {
    params['filter[search]'] = q.term;
  }
  if (q.categoryId) {
    params['filter[category_id]'] = q.categoryId;
  }
  // Сервер проверяет правилом boolean: `true` строкой он отклоняет, `1` — нет.
  if (q.recent) {
    params['filter[recent]'] = 1;
  }
  if (q.inStock) {
    params['filter[in_stock]'] = 1;
  }
  return params;
};

/**
 * Товары для поля «+ Товар» и «Подбора»: поиск с задержкой 250 мс,
 * страницы по 30 с догрузкой `loadMore`. Ответ устаревшего запроса
 * отбрасывается. `term` — искомая строка, по которой уже пришёл ответ
 * (пока она отстаёт от ввода, идёт поиск).
 */
export function useProductPicker({ storeId, search = '', categoryId = null, recent = false, inStock = false, enabled = true }: PickerQuery) {
  const [term, setTerm] = useState(search.trim());
  const [items, setItems] = useState<PickerProduct[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [answeredTerm, setAnsweredTerm] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setTerm(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!enabled || storeId === null) {
      return;
    }
    const id = ++requestId.current;
    // Запрос к API — внешней системе; состояние загрузки ставится здесь же.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    api
      .get<PickerPage>('/admin/product-picker', { params: paramsFor({ storeId, term, categoryId, recent, inStock }, 1) })
      .then((res) => {
        if (id === requestId.current) {
          setItems(res.data.data);
          setPage(res.data.current_page);
          setLastPage(res.data.last_page);
          setAnsweredTerm(term);
        }
      })
      .catch(() => {
        if (id === requestId.current) {
          setItems([]);
          setAnsweredTerm(term);
        }
      })
      .finally(() => {
        if (id === requestId.current) {
          setLoading(false);
        }
      });
  }, [enabled, storeId, term, categoryId, recent, inStock]);

  const loadMore = useCallback(() => {
    if (loading || page >= lastPage || storeId === null) {
      return;
    }
    const id = ++requestId.current;
    setLoading(true);
    api
      .get<PickerPage>('/admin/product-picker', { params: paramsFor({ storeId, term, categoryId, recent, inStock }, page + 1) })
      .then((res) => {
        if (id === requestId.current) {
          setItems((current) => [...current, ...res.data.data]);
          setPage(res.data.current_page);
          setLastPage(res.data.last_page);
        }
      })
      .finally(() => {
        if (id === requestId.current) {
          setLoading(false);
        }
      });
  }, [loading, page, lastPage, storeId, term, categoryId, recent, inStock]);

  return { items, loading, hasMore: page < lastPage, loadMore, term: answeredTerm ?? '' };
}
