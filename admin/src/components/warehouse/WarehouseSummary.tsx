'use client';

import { usePathname } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import api from '@/lib/api';
import type { StockSummary } from '@/lib/warehouse';

type SummaryState = { summary: StockSummary | null; failed: boolean; reload: () => void };

const SummaryContext = createContext<SummaryState>({ summary: null, failed: false, reload: () => undefined });

/**
 * Сводка склада одним запросом на переход: её читают и шапка раздела
 * (счётчик черновиков на вкладке «Документы»), и вкладка «Обзор».
 * Перезапрашивается при смене адреса — после проведения документа цифры
 * свежие без перезагрузки страницы.
 */
export function WarehouseSummaryProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [summary, setSummary] = useState<StockSummary | null>(null);
  const [failed, setFailed] = useState(false);

  const reload = useCallback(() => {
    api
      .get<{ data: StockSummary }>('/admin/stock/summary')
      .then((res) => {
        setSummary(res.data.data);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    // Fetch on navigation: the summary mirrors the API, an external system.
    reload();
  }, [reload, pathname]);

  return <SummaryContext.Provider value={{ summary, failed, reload }}>{children}</SummaryContext.Provider>;
}

export function useWarehouseSummary(): SummaryState {
  return useContext(SummaryContext);
}
