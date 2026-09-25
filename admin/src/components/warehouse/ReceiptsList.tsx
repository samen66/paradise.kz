'use client';

import Link from 'next/link';
import { useResource } from '@/lib/crud';
import { formatTenge } from '@/lib/money';
import { formatDateTime, warehouseHref, type DocumentStatus, type GoodsReceiptListItem } from '@/lib/warehouse';
import DataTable, { type Column } from '@/components/ui/DataTable';
import EmptyState from '@/components/ui/EmptyState';
import { buttonGhost } from '@/components/ui/styles';
import CreateDocumentButton from './CreateDocumentButton';
import DocumentStatusBadge from './DocumentStatusBadge';

type Props = {
  status: '' | DocumentStatus;
  storeId: string;
  page: number;
  onPageChange: (page: number) => void;
  hasFilters: boolean;
  onResetFilters: () => void;
};

/** Приёмки: черновики сверху (сортирует сервер), фильтры и страница — из адреса. */
export default function ReceiptsList({ status, storeId, page, onPageChange, hasFilters, onResetFilters }: Props) {
  const params: Record<string, string | number> = { page };
  if (status) params['filter[status]'] = status;
  if (storeId) params['filter[store_id]'] = storeId;

  const receipts = useResource<GoodsReceiptListItem>('/admin/goods-receipts', params);

  const columns: Column<GoodsReceiptListItem>[] = [
    {
      key: 'number',
      header: 'Приёмка',
      mobile: 'title',
      render: (r) => (
        <Link href={warehouseHref.receipt(r.id)} className="font-medium text-zinc-900 hover:text-blue-700">
          {r.number || `№${r.id}`}
        </Link>
      ),
    },
    { key: 'status', header: 'Статус', mobile: 'badge', render: (r) => <DocumentStatusBadge status={r.status} postedLabel="Проведена" /> },
    { key: 'date', header: 'Дата', mobile: 'meta', render: (r) => `${formatDateTime(r.received_at)} · ${r.store.name}` },
    { key: 'supplier', header: 'Поставщик', mobile: 'meta', render: (r) => r.supplier?.name ?? '—' },
    { key: 'items', header: 'Позиций', mobile: 'hidden', render: (r) => r.items_count },
    { key: 'total', header: 'Сумма', mobile: 'meta', render: (r) => formatTenge(r.total_cost) },
  ];

  return (
    <DataTable
      columns={columns}
      rows={receipts.items}
      loading={receipts.loading}
      meta={receipts.meta}
      onPageChange={onPageChange}
      empty={
        hasFilters ? (
          <EmptyState
            title="Ничего не найдено"
            hint="Измените или сбросьте фильтры."
            action={
              <button type="button" className={buttonGhost} onClick={onResetFilters}>
                Сбросить фильтры
              </button>
            }
          />
        ) : (
          <EmptyState title="Приёмок пока нет" hint="Нажмите «Принять товар» — черновик откроется сразу, товары добавите в нём." action={<CreateDocumentButton kind="receipt" />} />
        )
      }
    />
  );
}
