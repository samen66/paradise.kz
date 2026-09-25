'use client';

import { formatTenge } from '@/lib/money';
import { ru } from '@/lib/text';
import { useIsDesktop } from '@/lib/useIsDesktop';
import { formatQty, lineCost, type DraftKind } from '@/lib/warehouse';
import EmptyState from '@/components/ui/EmptyState';
import MoneyInput from '@/components/ui/MoneyInput';
import { cardClass } from '@/components/ui/styles';
import ProductThumb from './ProductThumb';
import QuantityStepper from './QuantityStepper';
import { lineKey, type LineRow } from './useDocument';

type Props = {
  kind: DraftKind;
  rows: LineRow[];
  highlightId: number | null;
  errors: Record<string, string>;
  onEdit: (id: number, patch: { quantity?: string; cost?: string }) => void;
  onFlush: (id: number) => void;
  onRemove: (id: number) => void;
};

const nameOf = (row: LineRow): string => ru(row.product.name) || `#${row.productId}`;

const sumOf = (row: LineRow): string =>
  row.invalid ? '—' : formatTenge(lineCost(row.quantity, Math.round(Number(row.cost) * 100)));

/** Текст под строкой: ошибка сервера, ввода или «больше, чем на складе». */
const problemOf = (row: LineRow, errors: Record<string, string>, kind: DraftKind): string | null =>
  errors[lineKey(row.id)] ??
  row.invalid ??
  (kind === 'write_off' && row.available !== null && Number(row.quantity) > row.available ? 'Больше, чем на складе' : null);

/** Позиции черновика: таблица с полями на ПК, карточки со степпером на телефоне. */
export default function DocumentLines({ kind, rows, highlightId, errors, onEdit, onFlush, onRemove }: Props) {
  const isDesktop = useIsDesktop();

  if (rows.length === 0) {
    return <EmptyState title="Добавьте товары" hint="Найдите товар в поле ниже или откройте «Подбор»." />;
  }

  const removeButton = (row: LineRow) => (
    <button
      type="button"
      aria-label={`Удалить: ${nameOf(row)}`}
      onClick={() => onRemove(row.id)}
      className="inline-flex h-11 w-11 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-red-600 md:h-9 md:w-9"
    >
      ✕
    </button>
  );

  const quantity = (row: LineRow) => (
    <QuantityStepper
      value={row.quantity}
      label={nameOf(row)}
      onChange={(value) => onEdit(row.id, { quantity: value })}
      onBlur={() => onFlush(row.id)}
    />
  );

  const cost = (row: LineRow) => (
    <MoneyInput
      aria-label={`Себестоимость: ${nameOf(row)}`}
      value={row.cost}
      onChange={(e) => onEdit(row.id, { cost: e.target.value })}
      onBlur={() => onFlush(row.id)}
      className="w-32"
    />
  );

  const problem = (row: LineRow) => {
    const text = problemOf(row, errors, kind);
    return text ? (
      <p role="alert" className="mt-1 text-xs text-red-600">
        {text}
      </p>
    ) : null;
  };

  if (!isDesktop) {
    return (
      <ul className="space-y-3">
        {rows.map((row) => (
          <li
            key={row.id}
            data-testid="document-line"
            className={`${cardClass} p-4 transition-colors ${row.id === highlightId ? 'ring-2 ring-blue-400' : ''}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-3">
                <ProductThumb url={row.product.thumb_url} />
                <div className="min-w-0">
                  <div className="font-medium text-zinc-900">{nameOf(row)}</div>
                  <div className="text-xs text-zinc-500">{row.product.article || row.product.code || '—'}</div>
                </div>
              </div>
              {removeButton(row)}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {quantity(row)}
              {kind === 'receipt' ? cost(row) : <span className="text-sm text-zinc-600">На складе: {formatQty(row.available ?? 0)}</span>}
            </div>
            {kind === 'receipt' && <div className="mt-2 text-sm text-zinc-700">Сумма: {sumOf(row)}</div>}
            {problem(row)}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className={`${cardClass} overflow-hidden`}>
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
          <tr>
            <th className="px-4 py-2 font-medium">Товар</th>
            <th className="px-4 py-2 font-medium">Кол-во</th>
            {kind === 'receipt' ? (
              <>
                <th className="px-4 py-2 font-medium">Себест., ₸</th>
                <th className="px-4 py-2 text-right font-medium">Сумма</th>
              </>
            ) : (
              <th className="px-4 py-2 text-right font-medium">На складе</th>
            )}
            <th className="w-12" />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.map((row) => (
            <tr key={row.id} data-testid="document-line" className={`transition-colors ${row.id === highlightId ? 'bg-blue-50' : ''}`}>
              <td className="px-4 py-2 align-top">
                <div className="flex items-center gap-3">
                  <ProductThumb url={row.product.thumb_url} />
                  <div className="min-w-0">
                    <div className="font-medium text-zinc-900">{nameOf(row)}</div>
                    <div className="text-xs text-zinc-500">{row.product.article || row.product.code || '—'}</div>
                  </div>
                </div>
                {problem(row)}
              </td>
              <td className="px-4 py-2 align-top">{quantity(row)}</td>
              {kind === 'receipt' ? (
                <>
                  <td className="px-4 py-2 align-top">{cost(row)}</td>
                  <td className="px-4 py-2 text-right align-top font-medium">{sumOf(row)}</td>
                </>
              ) : (
                <td className="px-4 py-2 text-right align-top">{formatQty(row.available ?? 0)}</td>
              )}
              <td className="px-2 py-1 text-right align-top">{removeButton(row)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
