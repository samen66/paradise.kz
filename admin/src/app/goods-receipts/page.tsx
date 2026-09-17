'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useResource } from '@/lib/crud';
import { formatTenge } from '@/lib/money';
import { formatDateTime, type GoodsReceipt, type GoodsReceiptListItem, type Supplier } from '@/lib/warehouse';
import CrudModal from '@/components/ui/CrudModal';
import DataTable, { type Column } from '@/components/ui/DataTable';
import PageHeader from '@/components/ui/PageHeader';
import { buttonPrimary, inputClass } from '@/components/ui/styles';
import DocumentStatusBadge from '@/components/warehouse/DocumentStatusBadge';
import StoreSelect from '@/components/warehouse/StoreSelect';
import { ReceiptFields, receiptSchema, toReceiptForm } from '@/components/warehouse/GoodsReceiptForm';

export default function GoodsReceiptsPage() {
  const router = useRouter();
  const [status, setStatus] = useState('');
  const [storeId, setStoreId] = useState('');
  const params: Record<string, string> = {};
  if (status) params['filter[status]'] = status;
  if (storeId) params['filter[store_id]'] = storeId;

  const receipts = useResource<GoodsReceiptListItem>('/admin/goods-receipts', params);
  const suppliers = useResource<Supplier>('/admin/suppliers');
  const [creating, setCreating] = useState(false);

  const columns: Column<GoodsReceiptListItem>[] = [
    {
      key: 'number',
      header: 'Приёмка',
      render: (r) => (
        <Link href={`/goods-receipts/${r.id}`} className="font-medium text-zinc-900 hover:text-blue-700">
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
      <PageHeader
        title="Приёмки"
        actions={<button type="button" className={buttonPrimary} onClick={() => setCreating(true)}>Новая приёмка</button>}
      />
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

      {creating && (
        <CrudModal
          title="Новая приёмка"
          schema={receiptSchema}
          defaultValues={toReceiptForm(null)}
          onSubmit={async (values) => {
            const receipt = (await receipts.create(values)) as unknown as GoodsReceipt;
            router.push(`/goods-receipts/${receipt.id}`);
          }}
          onClose={() => setCreating(false)}
        >
          {(form) => <ReceiptFields form={form} suppliers={suppliers.items} />}
        </CrudModal>
      )}
    </div>
  );
}
