'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { parseDocumentKind, parseDocumentStatus, parseWriteOffReason, warehouseHref, WRITE_OFF_REASONS } from '@/lib/warehouse';
import FilterChips from '@/components/ui/FilterChips';
import LinkTabs from '@/components/ui/LinkTabs';
import { inputClass } from '@/components/ui/styles';
import ReceiptsList from '@/components/warehouse/ReceiptsList';
import StoreSelect from '@/components/warehouse/StoreSelect';
import { useWarehouseSummary } from '@/components/warehouse/WarehouseSummary';
import WriteOffsList from '@/components/warehouse/WriteOffsList';

/** Фильтры вкладки живут в адресе: F5, «назад» и ссылка открывают тот же список. */
function DocumentsView() {
  const params = useSearchParams();
  const router = useRouter();
  const { summary } = useWarehouseSummary();
  const kind = parseDocumentKind(params.get('kind'));
  const status = parseDocumentStatus(params.get('status'));
  const storeId = params.get('store_id') ?? '';
  const reason = kind === 'write_offs' ? parseWriteOffReason(params.get('reason')) : '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const hasFilters = Boolean(status || storeId || reason);

  const setFilter = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) {
        next.set(key, value);
      } else {
        next.delete(key);
      }
    }
    if (!('page' in patch)) {
      next.delete('page');
    }
    router.replace(`${warehouseHref.documents(kind).split('?')[0]}?${next.toString()}`, { scroll: false });
  };

  const resetFilters = () => router.replace(warehouseHref.documents(kind), { scroll: false });
  const drafts = summary ? summary.drafts[kind] : null;
  const listProps = { status, storeId, page, onPageChange: (p: number) => setFilter({ page: String(p) }), hasFilters, onResetFilters: resetFilters };

  return (
    <div className="space-y-4">
      <LinkTabs
        variant="segmented"
        label="Вид документов"
        active={kind}
        tabs={[
          { key: 'receipts', href: warehouseHref.documents('receipts'), label: 'Приёмки' },
          { key: 'write_offs', href: warehouseHref.documents('write_offs'), label: 'Списания' },
        ]}
      />
      <FilterChips
        label="Статус"
        value={status}
        onChange={(value) => setFilter({ status: value })}
        options={[
          { value: '', label: 'Все' },
          { value: 'draft', label: 'Черновики', count: drafts },
          { value: 'posted', label: 'Проведённые' },
        ]}
      />
      <div className="flex flex-col gap-3 md:flex-row">
        <StoreSelect aria-label="Склад" emptyLabel="Все склады" className="md:max-w-64" value={storeId} onChange={(e) => setFilter({ store_id: e.target.value })} />
        {kind === 'write_offs' && (
          <select aria-label="Причина" className={`${inputClass} md:max-w-56`} value={reason} onChange={(e) => setFilter({ reason: e.target.value })}>
            <option value="">Все причины</option>
            {Object.entries(WRITE_OFF_REASONS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        )}
      </div>
      {kind === 'receipts' ? <ReceiptsList {...listProps} /> : <WriteOffsList {...listProps} reason={reason} />}
    </div>
  );
}

export default function DocumentsPage() {
  // useSearchParams needs a Suspense boundary for the static build.
  return (
    <Suspense fallback={null}>
      <DocumentsView />
    </Suspense>
  );
}
