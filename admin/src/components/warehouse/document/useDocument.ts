'use client';

import { isAxiosError } from 'axios';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { serverMessage } from '@/lib/errors';
import { TENGE_PATTERN, tiynToTenge } from '@/lib/money';
import { plural, ru, type ProductRef } from '@/lib/text';
import { useAutosave, type SaveState } from '@/lib/useAutosave';
import { useUnsavedGuard } from '@/lib/useUnsavedGuard';
import {
  documentApiPath,
  kindOfDocuments,
  lineCost,
  QUANTITY_PATTERN,
  warehouseHref,
  type DocumentItem,
  type DraftKind,
  type GoodsReceipt,
  type WriteOff,
} from '@/lib/warehouse';
import { toast } from '@/stores/toastStore';

export type DocumentHeaderData = GoodsReceipt | WriteOff;

/** Строка документа на экране: количество и цена — как введены, а не как сохранены. */
export type LineRow = {
  id: number;
  productId: number;
  product: ProductRef;
  /** «2», «1.5», «1.» — текст поля. */
  quantity: string;
  /** Себестоимость в ₸ текстом поля (только приёмка). */
  cost: string;
  /** Себестоимость с сервера, тиыны — для проведённой приёмки. */
  unitCost: number | null;
  /** Остаток на складе списания. */
  available: number | null;
  /** Ошибка ввода, найденная до отправки. */
  invalid: string | null;
};

export const lineKey = (id: number): string => `line:${id}`;

const QUANTITY_MESSAGE = 'Количество больше нуля, до 3 знаков после точки';
const COST_MESSAGE = 'Себестоимость в ₸, до двух знаков после точки';

const toRow = (item: DocumentItem): LineRow => ({
  id: item.id,
  productId: item.product_id,
  product: item.product,
  quantity: String(Number(item.quantity)),
  cost: tiynToTenge(item.unit_cost),
  unitCost: item.unit_cost ?? null,
  available: item.available ?? null,
  invalid: null,
});

/**
 * Строки с сервера поверх введённых: у уже известной строки остаётся её
 * ввод (он мог ещё не уйти), кроме строк из `fresh` — их значения только что
 * изменил сам сервер (повторный товар, пачка, возврат).
 */
const mergeRows = (items: DocumentItem[], previous: LineRow[], fresh: Set<number>): LineRow[] =>
  items.map((item) => {
    const known = previous.find((row) => row.id === item.id);
    return known && !fresh.has(item.id) ? { ...known, product: item.product, available: item.available ?? null } : toRow(item);
  });

const validate = (row: LineRow, kind: DraftKind): string | null => {
  if (!QUANTITY_PATTERN.test(row.quantity) || Number(row.quantity) <= 0) {
    return QUANTITY_MESSAGE;
  }
  if (kind === 'receipt' && !TENGE_PATTERN.test(row.cost)) {
    return COST_MESSAGE;
  }
  return null;
};

const toMilli = (quantity: string): number => (QUANTITY_PATTERN.test(quantity) ? Math.round(Number(quantity) * 1000) : 0);

const reportRefusal = (error: unknown): void => {
  const message = serverMessage(error);
  if (message) {
    toast.error(message);
  }
};

/**
 * Данные и действия «живого документа» (приёмки или списания): загрузка
 * шапки и строк, правки строк и шапки через очередь автосохранения,
 * добавление по одному и пачкой, удаление с «Вернуть», проведение.
 */
export function useDocument(kind: DraftKind, id: string) {
  const router = useRouter();
  const base = `${documentApiPath(kind)}/${id}`;
  const { state: saveState, errors, hasUnsaved, schedule, flush, run, cancel, retry } = useAutosave();
  const [header, setHeader] = useState<DocumentHeaderData | null>(null);
  const [rows, setRows] = useState<LineRow[]>([]);
  const rowsRef = useRef<LineRow[]>([]);
  const [loadError, setLoadError] = useState<'not_found' | 'error' | null>(null);
  const [highlightId, setHighlightId] = useState<number | null>(null);

  const commitRows = useCallback((next: LineRow[]) => {
    rowsRef.current = next;
    setRows(next);
  }, []);

  const load = useCallback(async () => {
    try {
      const [doc, items] = await Promise.all([
        api.get<{ data: DocumentHeaderData }>(base),
        api.get<{ data: DocumentItem[] }>(`${base}/items`),
      ]);
      setHeader(doc.data.data);
      commitRows(items.data.data.map(toRow));
      setLoadError(null);
    } catch (error) {
      setLoadError(isAxiosError(error) && error.response?.status === 404 ? 'not_found' : 'error');
    }
  }, [base, commitRows]);

  useEffect(() => {
    // Fetch-on-mount: load() synchronizes with the API, an external system.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const refreshLines = useCallback(
    async (fresh: Set<number> = new Set()) => {
      const res = await api.get<{ data: DocumentItem[] }>(`${base}/items`);
      commitRows(mergeRows(res.data.data, rowsRef.current, fresh));
    },
    [base, commitRows],
  );

  const flash = useCallback((lineId: number) => {
    setHighlightId(lineId);
    window.setTimeout(() => setHighlightId((current) => (current === lineId ? null : current)), 2000);
  }, []);

  const addProduct = useCallback(
    async (productId: number) => {
      try {
        const res = await api.post<{ data: DocumentItem }>(`${base}/items`, { product_id: productId });
        const lineId = res.data.data.id;
        cancel(lineKey(lineId));
        await refreshLines(new Set([lineId]));
        flash(lineId);
      } catch (error) {
        reportRefusal(error);
      }
    },
    [base, cancel, refreshLines, flash],
  );

  const addMany = useCallback(
    async (items: { product_id: number; quantity: string }[]): Promise<boolean> => {
      try {
        const res = await api.post<{ data: DocumentItem[] }>(`${base}/items/batch`, { items });
        const touched = new Set(items.map((item) => item.product_id));
        const fresh = new Set(res.data.data.filter((item) => touched.has(item.product_id)).map((item) => item.id));
        fresh.forEach((lineId) => cancel(lineKey(lineId)));
        commitRows(mergeRows(res.data.data, rowsRef.current, fresh));
        toast.success(`Добавлено ${items.length} ${plural(items.length, ['позиция', 'позиции', 'позиций'])}`);
        return true;
      } catch (error) {
        reportRefusal(error);
        return false;
      }
    },
    [base, cancel, commitRows],
  );

  const editLine = useCallback(
    (lineId: number, patch: { quantity?: string; cost?: string }) => {
      const current = rowsRef.current.find((row) => row.id === lineId);
      if (!current) {
        return;
      }
      const next: LineRow = { ...current, ...patch };
      next.invalid = validate(next, kind);
      commitRows(rowsRef.current.map((row) => (row.id === lineId ? next : row)));

      if (next.invalid) {
        cancel(lineKey(lineId));
        return;
      }

      const payload = kind === 'receipt' ? { quantity: next.quantity, unit_cost: next.cost } : { quantity: next.quantity };
      schedule(lineKey(lineId), () => api.put(`${base}/items/${lineId}`, payload));
    },
    [base, kind, cancel, schedule, commitRows],
  );

  const flushLine = useCallback((lineId: number) => flush(lineKey(lineId)), [flush]);

  const restoreLine = useCallback(
    async (row: LineRow) => {
      const quantity = row.invalid ? undefined : row.quantity;
      const payload =
        kind === 'receipt'
          ? { product_id: row.productId, quantity, unit_cost: row.invalid ? undefined : row.cost }
          : { product_id: row.productId, quantity };
      try {
        const res = await api.post<{ data: DocumentItem }>(`${base}/items`, payload);
        await refreshLines(new Set([res.data.data.id]));
        flash(res.data.data.id);
      } catch (error) {
        reportRefusal(error);
      }
    },
    [base, kind, refreshLines, flash],
  );

  const removeLine = useCallback(
    async (lineId: number) => {
      const row = rowsRef.current.find((r) => r.id === lineId);
      if (!row) {
        return;
      }
      cancel(lineKey(lineId));
      commitRows(rowsRef.current.filter((r) => r.id !== lineId));
      try {
        await api.delete(`${base}/items/${lineId}`);
        toast.undo(`Позиция удалена: ${ru(row.product.name) || `#${row.productId}`}`, {
          label: 'Вернуть',
          onClick: () => void restoreLine(row),
        });
      } catch (error) {
        await refreshLines();
        reportRefusal(error);
      }
    },
    [base, cancel, commitRows, refreshLines, restoreLine],
  );

  const saveHeader = useCallback(
    (patch: Record<string, string | null>) => {
      const field = Object.keys(patch)[0];
      void run(`header:${field}`, async () => {
        const res = await api.put<{ data: DocumentHeaderData }>(base, patch);
        setHeader(res.data.data);
        // У списания «На складе» считается по складу документа.
        if ('store_id' in patch) {
          await refreshLines();
        }
      });
    },
    [base, run, refreshLines],
  );

  const post = useCallback(async () => {
    try {
      const res = await api.post<{ data: DocumentHeaderData }>(`${base}/post`);
      setHeader(res.data.data);
      await refreshLines(new Set(rowsRef.current.map((row) => row.id)));
      toast.success(kind === 'receipt' ? 'Приёмка проведена' : 'Списание проведено');
    } catch (error) {
      reportRefusal(error);
      await load();
    }
  }, [base, kind, refreshLines, load]);

  const removeDraft = useCallback(async () => {
    await api.delete(base);
    toast.success('Черновик удалён');
    router.push(warehouseHref.documents(kindOfDocuments(kind)));
  }, [base, kind, router]);

  const units = rows.reduce((sum, row) => sum + toMilli(row.quantity), 0) / 1000;
  const cost =
    kind === 'receipt'
      ? rows.reduce((sum, row) => sum + (row.invalid ? 0 : lineCost(row.quantity, Math.round(Number(row.cost) * 100))), 0)
      : null;
  const overStock = kind === 'write_off' && rows.some((row) => row.available !== null && Number(row.quantity) > row.available);
  const hasInvalid = rows.some((row) => row.invalid !== null);

  const blocker =
    rows.length === 0
      ? 'Добавьте хотя бы один товар'
      : hasInvalid
        ? 'Исправьте строки с ошибкой'
        : saveState === 'error'
          ? 'Есть несохранённые изменения — нажмите «Повторить»'
          : hasUnsaved
            ? 'Сохраняю изменения…'
            : overStock
              ? 'В строке больше, чем на складе'
              : null;

  useUnsavedGuard(hasUnsaved || hasInvalid);

  return {
    header,
    rows,
    loadError,
    reload: load,
    highlightId,
    saveState: saveState as SaveState,
    errors,
    retry,
    editLine,
    flushLine,
    removeLine,
    addProduct,
    addMany,
    saveHeader,
    post,
    removeDraft,
    totals: { count: rows.length, units, cost },
    blocker,
  };
}
