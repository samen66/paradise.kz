'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useResource } from '@/lib/crud';
import { formatDateTime, parseDocumentStatus, warehouseHref, WRITE_OFF_REASONS, type DocumentStatus, type WriteOffListItem } from '@/lib/warehouse';
import DataTable, { type Column } from '@/components/ui/DataTable';
import { inputClass } from '@/components/ui/styles';
import DocumentStatusBadge from './DocumentStatusBadge';
import StoreSelect from './StoreSelect';

type Props = { initialStatus?: '' | DocumentStatus };

/**
 * Список списаний с фильтрами по статусу, складу и причине. Создание —
 * кнопкой в шапке раздела. `initialStatus` — из адреса (плитка «Черновики» на обзоре).
 */
export default function WriteOffsList({ initialStatus = '' }: Props) {
  const [status, setStatus] = useState(initialStatus);
  const [storeId, setStoreId] = useState('');
  const [reason, setReason] = useState('');
  const params: Record<string, string> = {};
  if (status) params['filter[status]'] = status;
  if (storeId) params['filter[store_id]'] = storeId;
  if (reason) params['filter[reason]'] = reason;

  const writeOffs = useResource<WriteOffListItem>('/admin/write-offs', params);
  const resetPage = () => writeOffs.setPage(1);

  const columns: Column<WriteOffListItem>[] = [
    {
      key: 'label',
      header: 'Списание',
      render: (w) => (
        <Link href={warehouseHref.writeOff(w.id)} className="font-medium text-zinc-900 hover:text-blue-700">
          №{w.id}
        </Link>
      ),
    },
    { key: 'date', header: 'Дата', render: (w) => formatDateTime(w.posted_at ?? w.created_at) },
    { key: 'store', header: 'Склад', render: (w) => w.store.name },
    { key: 'reason', header: 'Причина', render: (w) => WRITE_OFF_REASONS[w.reason] ?? w.reason },
    { key: 'items', header: 'Позиций', render: (w) => w.items_count },
    { key: 'status', header: 'Статус', render: (w) => <DocumentStatusBadge status={w.status} postedLabel="Проведено" /> },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3">
        <select aria-label="Статус" className={`${inputClass} max-w-48`} value={status} onChange={(e) => { setStatus(parseDocumentStatus(e.target.value)); resetPage(); }}>
          <option value="">Все статусы</option>
          <option value="draft">Черновики</option>
          <option value="posted">Проведённые</option>
        </select>
        <StoreSelect aria-label="Склад" emptyLabel="Все склады" className="max-w-64" value={storeId} onChange={(e) => { setStoreId(e.target.value); resetPage(); }} />
        <select aria-label="Причина" className={`${inputClass} max-w-56`} value={reason} onChange={(e) => { setReason(e.target.value); resetPage(); }}>
          <option value="">Все причины</option>
          {Object.entries(WRITE_OFF_REASONS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>
      <DataTable
        columns={columns}
        rows={writeOffs.items}
        loading={writeOffs.loading}
        meta={writeOffs.meta}
        onPageChange={writeOffs.setPage}
        emptyText="Списаний нет"
      />
    </div>
  );
}
