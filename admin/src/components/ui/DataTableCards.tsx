import { Fragment, type ReactNode } from 'react';
import type { Column, MobileRole } from './DataTable';
import Skeleton from './Skeleton';
import { cardClass } from './styles';

type CardListProps<T> = {
  columns: Column<T>[];
  rows: T[];
  loading: boolean;
  /** Что показать, когда записей нет (EmptyState). */
  empty: ReactNode;
  rowKey: (row: T) => string | number;
};

/**
 * Записи карточками — вид DataTable на телефоне.
 *
 * Раскладка по ролям колонок (`Column.mobile`):
 *   title и badge — первая строка (заголовок слева, метки справа);
 *   meta — мелкая строка под ней;
 *   колонки без роли — строки «Заголовок: значение», без заголовка — просто значение;
 *   actions — внизу, под чертой; hidden — не показываются.
 * `className` колонок здесь не применяется: он для ячеек таблицы.
 */
export function CardList<T>({ columns, rows, loading, empty, rowKey }: CardListProps<T>) {
  if (loading) {
    return (
      <ul className="space-y-3" aria-busy="true">
        <span className="sr-only">Загрузка…</span>
        {[0, 1, 2].map((i) => (
          <li key={i} className={`${cardClass} space-y-3 p-4`}>
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </li>
        ))}
      </ul>
    );
  }

  if (rows.length === 0) {
    return <>{empty}</>;
  }

  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={rowKey(row)} className={`${cardClass} p-4 text-sm text-zinc-700`}>
          <RowCard columns={columns} row={row} />
        </li>
      ))}
    </ul>
  );
}

function RowCard<T>({ columns, row }: { columns: Column<T>[]; row: T }) {
  const withRole = (role: MobileRole) => columns.filter((c) => c.mobile === role);
  const titles = withRole('title');
  const badges = withRole('badge');
  const metas = withRole('meta');
  const actions = withRole('actions');
  const fields = columns.filter((c) => c.mobile === undefined);

  return (
    <div className="space-y-2">
      {(titles.length > 0 || badges.length > 0) && (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 break-words font-medium text-zinc-900">
            {titles.map((c) => (
              <div key={c.key}>{c.render(row)}</div>
            ))}
          </div>
          {badges.length > 0 && (
            <div className="flex shrink-0 flex-wrap justify-end gap-1">
              {badges.map((c) => (
                <Fragment key={c.key}>{c.render(row)}</Fragment>
              ))}
            </div>
          )}
        </div>
      )}

      {metas.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
          {metas.map((c) => (
            <div key={c.key}>{c.render(row)}</div>
          ))}
        </div>
      )}

      {fields.map((c) =>
        c.header ? (
          <div key={c.key} className="flex items-baseline justify-between gap-3">
            <div className="shrink-0 text-zinc-500">{c.header}</div>
            <div className="min-w-0 break-words text-right">{c.render(row)}</div>
          </div>
        ) : (
          <div key={c.key} className="flex justify-end">
            {c.render(row)}
          </div>
        ),
      )}

      {actions.length > 0 && (
        <div className="flex flex-wrap items-center justify-end gap-x-4 border-t border-zinc-100 pt-2">
          {actions.map((c) => (
            <Fragment key={c.key}>{c.render(row)}</Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
