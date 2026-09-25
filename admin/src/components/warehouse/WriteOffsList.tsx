'use client';

import Link from 'next/link';
import { useResource } from '@/lib/crud';
import { formatDateTime, warehouseHref, WRITE_OFF_REASONS, type DocumentStatus, type WriteOffListItem, type WriteOffReason } from '@/lib/warehouse';
import DataTable, { type Column } from '@/components/ui/DataTable';
import EmptyState from '@/components/ui/EmptyState';
import { buttonGhost } from '@/components/ui/styles';
import CreateDocumentButton from './CreateDocumentButton';
import DocumentStatusBadge from './DocumentStatusBadge';

type Props = {
  status: '' | DocumentStatus;
  storeId: string;
  reason: '' | WriteOffReason;
  page: number;
  onPageChange: (page: number) => void;
  hasFilters: boolean;
  onResetFilters: () => void;
};

/** Списания: черновики сверху (сортирует сервер), фильтры и страница — из адреса. */
export default function WriteOffsList({ status, storeId, reason, page, onPageChange, hasFilters, onResetFilters }: Props) {
  const params: Record<string, string | number> = { page };
  if (status) params['filter[status]'] = status;
  if (storeId) params['filter[store_id]'] = storeId;
  if (reason) params['filter[reason]'] = reason;

  const writeOffs = useResource<WriteOffListItem>('/admin/write-offs', params);

  const columns: Column<WriteOffListItem>[] = [
    {
      key: 'label',
      header: 'Списание',
      mobile: 'title',
      render: (w) => (
        <Link href={warehouseHref.writeOff(w.id)} className="font-medium text-zinc-900 hover:text-blue-700">
          №{w.id}
        </Link>
      ),
    },
    { key: 'status', header: 'Статус', mobile: 'badge', render: (w) => <DocumentStatusBadge status={w.status} postedLabel="Проведено" /> },
    { key: 'date', header: 'Дата', mobile: 'meta', render: (w) => `${formatDateTime(w.posted_at ?? w.created_at)} · ${w.store.name}` },
    { key: 'reason', header: 'Причина', mobile: 'meta', render: (w) => WRITE_OFF_REASONS[w.reason] ?? w.reason },
    { key: 'items', header: 'Позиций', mobile: 'hidden', render: (w) => w.items_count },
  ];

  return (
    <DataTable
      columns={columns}
      rows={writeOffs.items}
      loading={writeOffs.loading}
      meta={writeOffs.meta}
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
          <EmptyState title="Списаний пока нет" hint="Нажмите «Списать» — черновик откроется сразу." action={<CreateDocumentButton kind="write_off" />} />
        )
      }
    />
  );
}
