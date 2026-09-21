import { Fragment } from 'react';
import type { Column, MobileRole } from './DataTable';

type CardListProps<T> = {
  columns: Column<T>[];
  rows: T[];
  message: string | null;
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
export function CardList<T>({ columns, rows, message, rowKey }: CardListProps<T>) {
  if (message) {
    return (
      <p className="rounded-xl border border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-500">{message}</p>
    );
  }

  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={rowKey(row)} className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700 shadow-sm">
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
