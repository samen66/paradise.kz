'use client';

import { Fragment, useState, type ReactNode } from 'react';
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
  /** Только в карточке телефона — в таблице колонки нет. */
  hideOnDesktop?: boolean;
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
  /**
   * Раскрытие строки на ПК: кнопка «▸» в первой ячейке, под строкой —
   * `render(row)` во всю ширину. На телефоне то же содержимое карточка
   * показывает сама (колонкой с `hideOnDesktop`).
   */
  expandable?: { canExpand: (row: T) => boolean; render: (row: T) => ReactNode; label: string };
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
  expandable,
}: DataTableProps<T>) {
  const isDesktop = useIsDesktop();
  const [expanded, setExpanded] = useState<Set<string | number>>(new Set());
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

  const tableColumns = columns.filter((c) => !c.hideOnDesktop);
  const colSpan = tableColumns.length + (expandable ? 1 : 0);
  const toggle = (key: string | number) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });

  return (
    <div className={`${cardClass} overflow-hidden`}>
      {/* Широкая таблица прокручивается внутри рамки, а не обрезается ею. */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-zinc-700" aria-busy={loading}>
          <thead className="border-b border-zinc-100 bg-zinc-50/70">
            <tr>
              {expandable && (
                <th className="w-10 px-2 py-3">
                  <span className="sr-only">Раскрыть</span>
                </th>
              )}
              {tableColumns.map((c) => (
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
                  {tableColumns.map((c, index) => (
                    <td key={c.key} className="px-4 py-3">
                      {i === 0 && index === 0 && <span className="sr-only">Загрузка…</span>}
                      <Skeleton className={index === 0 ? 'h-4 w-40' : 'h-4 w-16'} />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={colSpan}>{emptyNode}</td>
              </tr>
            ) : (
              rows.map((row) => {
                const key = rowKey(row);
                const canExpand = expandable?.canExpand(row) ?? false;
                const isOpen = canExpand && expanded.has(key);

                return (
                  <Fragment key={key}>
                    <tr className="hover:bg-zinc-50/70">
                      {expandable && (
                        <td className="w-10 px-2 py-3 align-top">
                          {canExpand && (
                            <button
                              type="button"
                              aria-expanded={isOpen}
                              aria-label={expandable.label}
                              onClick={() => toggle(key)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100"
                            >
                              {isOpen ? '▾' : '▸'}
                            </button>
                          )}
                        </td>
                      )}
                      {tableColumns.map((c) => (
                        <td key={c.key} className={`px-4 py-3 ${c.className ?? ''}`}>
                          {c.render(row)}
                        </td>
                      ))}
                    </tr>
                    {isOpen && (
                      <tr className="bg-zinc-50/60">
                        <td colSpan={colSpan} className="px-4 py-3 pl-14">
                          {expandable!.render(row)}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
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
