import type { ReactNode } from 'react';
import type { PageMeta } from '@/lib/crud';
import { buttonSecondary } from './styles';

export type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
};

type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  emptyText?: string;
  meta?: PageMeta | null;
  onPageChange?: (page: number) => void;
  rowKey?: (row: T) => string | number;
};

export default function DataTable<T extends { id?: number }>({
  columns,
  rows,
  loading = false,
  emptyText = 'Ничего не найдено',
  meta,
  onPageChange,
  rowKey = (row) => row.id ?? JSON.stringify(row),
}: DataTableProps<T>) {
  const message = loading ? 'Загрузка…' : rows.length === 0 ? emptyText : null;

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm text-zinc-700">
        <thead className="border-b border-zinc-200 bg-zinc-50">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={`px-4 py-3 font-medium ${c.className ?? ''}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200">
          {message ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-zinc-500">
                {message}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={rowKey(row)} className="hover:bg-zinc-50">
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
      {meta && meta.last_page > 1 && onPageChange && (
        <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3 text-sm">
          <span className="text-zinc-500">
            Стр. {meta.current_page} из {meta.last_page}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className={buttonSecondary}
              disabled={meta.current_page <= 1}
              onClick={() => onPageChange(meta.current_page - 1)}
            >
              Назад
            </button>
            <button
              type="button"
              className={buttonSecondary}
              disabled={meta.current_page >= meta.last_page}
              onClick={() => onPageChange(meta.current_page + 1)}
            >
              Вперёд
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
