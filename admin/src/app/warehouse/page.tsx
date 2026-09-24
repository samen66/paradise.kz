'use client';

import Link from 'next/link';
import { formatTenge } from '@/lib/money';
import { ru } from '@/lib/text';
import { documentHref, formatDateTime, formatQty, warehouseHref, type StockSummary } from '@/lib/warehouse';
import NoActiveStoreWarning from '@/components/NoActiveStoreWarning';
import EmptyState from '@/components/ui/EmptyState';
import Skeleton from '@/components/ui/Skeleton';
import StatTile from '@/components/ui/StatTile';
import { buttonLink, buttonSecondary, cardClass } from '@/components/ui/styles';
import { useWarehouseSummary } from '@/components/warehouse/WarehouseSummary';

/** Куда ведёт плитка «Черновики»: туда, где черновики есть; приёмки — по умолчанию. */
const draftsHref = (summary: StockSummary): string =>
  `${warehouseHref.documents(summary.drafts.receipts === 0 && summary.drafts.write_offs > 0 ? 'write_offs' : 'receipts')}&status=draft`;

export default function WarehouseOverviewPage() {
  const { summary, failed, reload } = useWarehouseSummary();

  if (failed && !summary) {
    return (
      <EmptyState
        title="Не удалось загрузить сводку"
        action={<button type="button" className={buttonSecondary} onClick={reload}>Повторить</button>}
      />
    );
  }

  if (!summary) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-busy="true">
        <span className="sr-only">Загрузка…</span>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <NoActiveStoreWarning hasActiveStore={summary.has_active_store} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Стоимость запаса" value={formatTenge(summary.total_value)} icon="📦" href={warehouseHref.stock} />
        <StatTile label="Заканчивается" value={String(summary.low)} icon="⚠️" tone="warning" href={`${warehouseHref.stock}?status=low`} />
        <StatTile label="Нет в наличии" value={String(summary.out)} icon="⛔" tone="danger" href={`${warehouseHref.stock}?status=out`} />
        <StatTile
          label="Черновики"
          value={String(summary.drafts.receipts + summary.drafts.write_offs)}
          icon="📝"
          href={draftsHref(summary)}
        />
      </div>

      <section aria-labelledby="recent-movements" className={`${cardClass} p-4`}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="recent-movements" className="font-semibold text-zinc-900">Последние движения</h2>
          <Link href={warehouseHref.movements} className={buttonLink}>Все движения →</Link>
        </div>
        {summary.recent_movements.length === 0 ? (
          <EmptyState bare title="Движений ещё нет" hint="Остаток появится после первой проведённой приёмки." />
        ) : (
          <ul className="divide-y divide-zinc-100">
            {summary.recent_movements.map((m) => (
              <li key={m.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2 text-sm">
                <span className="min-w-0">
                  <span className={m.qty_delta >= 0 ? 'font-semibold text-green-700' : 'font-semibold text-red-600'}>
                    {m.qty_delta >= 0 ? '+' : '−'}
                    {formatQty(Math.abs(m.qty_delta))}
                  </span>{' '}
                  <span className="text-zinc-900">{ru(m.product?.name) || `#${m.product?.id}`}</span>
                  {m.document && (
                    <>
                      {' · '}
                      <Link href={documentHref(m.document)} className="text-blue-600 hover:text-blue-800">{m.document.label}</Link>
                    </>
                  )}
                </span>
                <span className="text-xs text-zinc-500">
                  {m.store?.name ?? '—'} · {formatDateTime(m.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
