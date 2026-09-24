'use client';

import type { ReactNode } from 'react';
import type { PageMeta } from '@/lib/crud';
import { useIsDesktop } from '@/lib/useIsDesktop';
import { CardList } from './DataTableCards';
import EmptyState from './EmptyState';
import Skeleton from './Skeleton';
import { buttonGhost, cardClass } from './styles';

/**
 * Роль колонки в карточке на телефоне (раскладка — в DataTableCards).
 * Колонка без роли выводится строкой «Заголовок: значение», так что любой
 * экран читается на телефоне и без разметки ролей.
 */
export type MobileRole = 'title' | 'badge' | 'meta' | 'actions' | 'hidden';

export type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Классы ячейки таблицы. В карточке не применяются. */
  className?: string;
  mobile?: MobileRole;
};

type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  emptyText?: string;
  /** Пустое состояние целиком (EmptyState с подсказкой и действием); перекрывает `emptyText`. */
  empty?: ReactNode;
  meta?: PageMeta | null;
  onPageChange?: (page: number) => void;
  rowKey?: (row: T) => string | number;
};

/**
 * Список записей: таблица с `md`, карточки на телефоне.
 *
 * В DOM попадает только один вариант — через useIsDesktop, а не CSS-скрытие.
 * Иначе удваивались бы меню действий в строках, а e2e-поиск по тексту
 * находил бы скрытую копию.
 */
export default function DataTable<T extends { id?: number }>({
  columns,
  rows,
  loading = false,
  emptyText = 'Ничего не найдено',
  empty,
  meta,
  onPageChange,
  rowKey = (row) => row.id ?? JSON.stringify(row),
}: DataTableProps<T>) {
  const isDesktop = useIsDesktop();
  const emptyNode = empty ?? <EmptyState title={emptyText} bare={isDesktop} />;
  const pagination =
    meta && meta.last_page > 1 && onPageChange ? (
      <Pagination meta={meta} onPageChange={onPageChange} compact={!isDesktop} />
    ) : null;

  if (!isDesktop) {
    return (
      <div>
        <CardList columns={columns} rows={rows} loading={loading} empty={emptyNode} rowKey={rowKey} />
        {pagination}
      </div>
    );
  }

  return (
    <div className={`${cardClass} overflow-hidden`}>
      {/* Широкая таблица прокручивается внутри рамки, а не обрезается ею. */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-zinc-700" aria-busy={loading}>
          <thead className="border-b border-zinc-100 bg-zinc-50/70">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={`px-4 py-3 font-medium text-zinc-500 ${c.className ?? ''}`}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {loading ? (
              [0, 1, 2, 3, 4].map((i) => (
                <tr key={i}>
                  {columns.map((c, index) => (
                    <td key={c.key} className="px-4 py-3">
                      {i === 0 && index === 0 && <span className="sr-only">Загрузка…</span>}
                      <Skeleton className={index === 0 ? 'h-4 w-40' : 'h-4 w-16'} />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>{emptyNode}</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={rowKey(row)} className="hover:bg-zinc-50/70">
                  {columns.map((c) => (
                    <td key={c.key} className={`px-4 py-3 ${c.className ?? ''}`}>
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {pagination}
    </div>
  );
}

type PaginationProps = { meta: PageMeta; onPageChange: (page: number) => void; compact: boolean };

/** На телефоне — под карточками, кнопки во всю ширину; на десктопе — полоса внизу таблицы. */
function Pagination({ meta, onPageChange, compact }: PaginationProps) {
  const buttons = (
    <>
      <button
        type="button"
        className={buttonGhost}
        disabled={meta.current_page <= 1}
        onClick={() => onPageChange(meta.current_page - 1)}
      >
        Назад
      </button>
      <button
        type="button"
        className={buttonGhost}
        disabled={meta.current_page >= meta.last_page}
        onClick={() => onPageChange(meta.current_page + 1)}
      >
        Вперёд
      </button>
    </>
  );

  if (compact) {
    return (
      <div className="mt-3 space-y-2 text-sm">
        <p className="text-center text-zinc-500">
          Стр. {meta.current_page} из {meta.last_page}
        </p>
        <div className="grid grid-cols-2 gap-2">{buttons}</div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-3 text-sm">
      <span className="text-zinc-500">
        Стр. {meta.current_page} из {meta.last_page}
      </span>
      <div className="flex gap-2">{buttons}</div>
    </div>
  );
}
