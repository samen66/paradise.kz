'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useResource } from '@/lib/crud';
import { formatTenge } from '@/lib/money';
import { formatDateTime, warehouseHref, type GoodsReceiptListItem } from '@/lib/warehouse';
import DataTable, { type Column } from '@/components/ui/DataTable';
import { inputClass } from '@/components/ui/styles';
import DocumentStatusBadge from './DocumentStatusBadge';
import StoreSelect from './StoreSelect';

/** Список приёмок с фильтрами по статусу и складу. Создание — кнопкой в шапке раздела. */
export default function ReceiptsList() {
  const [status, setStatus] = useState('');
  const [storeId, setStoreId] = useState('');
  const params: Record<string, string> = {};
  if (status) params['filter[status]'] = status;
  if (storeId) params['filter[store_id]'] = storeId;

  const receipts = useResource<GoodsReceiptListItem>('/admin/goods-receipts', params);

  const columns: Column<GoodsReceiptListItem>[] = [
    {
      key: 'number',
      header: 'Приёмка',
      render: (r) => (
        <Link href={warehouseHref.receipt(r.id)} className="font-medium text-zinc-900 hover:text-blue-700">
          {r.number || `№${r.id}`}
        </Link>
      ),
    },
    { key: 'date', header: 'Дата', render: (r) => formatDateTime(r.received_at) },
    { key: 'supplier', header: 'Поставщик', render: (r) => r.supplier?.name ?? '—' },
    { key: 'store', header: 'Склад', render: (r) => r.store.name },
    { key: 'items', header: 'Позиций', render: (r) => r.items_count },
    { key: 'total', header: 'Сумма', render: (r) => formatTenge(r.total_cost) },
    { key: 'status', header: 'Статус', render: (r) => <DocumentStatusBadge status={r.status} postedLabel="Проведена" /> },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3">
        <select
          aria-label="Статус"
          className={`${inputClass} max-w-48`}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            receipts.setPage(1);
          }}
        >
          <option value="">Все статусы</option>
          <option value="draft">Черновики</option>
          <option value="posted">Проведённые</option>
        </select>
        <StoreSelect
          aria-label="Склад"
          emptyLabel="Все склады"
          className="max-w-64"
          value={storeId}
          onChange={(e) => {
            setStoreId(e.target.value);
            receipts.setPage(1);
          }}
        />
      </div>
      <DataTable
        columns={columns}
        rows={receipts.items}
        loading={receipts.loading}
        meta={receipts.meta}
        onPageChange={receipts.setPage}
        emptyText="Приёмок нет"
      />
    </div>
  );
}
