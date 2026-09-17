'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useResource } from '@/lib/crud';
import { formatDateTime, WRITE_OFF_REASONS, type WriteOff, type WriteOffListItem } from '@/lib/warehouse';
import CrudModal from '@/components/ui/CrudModal';
import DataTable, { type Column } from '@/components/ui/DataTable';
import PageHeader from '@/components/ui/PageHeader';
import { buttonPrimary, inputClass } from '@/components/ui/styles';
import DocumentStatusBadge from '@/components/warehouse/DocumentStatusBadge';
import StoreSelect from '@/components/warehouse/StoreSelect';
import { toWriteOffForm, WriteOffFields, writeOffSchema } from '@/components/warehouse/WriteOffForm';

export default function WriteOffsPage() {
  const router = useRouter();
  const [status, setStatus] = useState('');
  const [storeId, setStoreId] = useState('');
  const [reason, setReason] = useState('');
  const params: Record<string, string> = {};
  if (status) params['filter[status]'] = status;
  if (storeId) params['filter[store_id]'] = storeId;
  if (reason) params['filter[reason]'] = reason;

  const writeOffs = useResource<WriteOffListItem>('/admin/write-offs', params);
  const [creating, setCreating] = useState(false);

  const columns: Column<WriteOffListItem>[] = [
    {
      key: 'label',
      header: 'Списание',
      render: (w) => (
        <Link href={`/write-offs/${w.id}`} className="font-medium text-zinc-900 hover:text-blue-700">
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

  const resetPage = () => writeOffs.setPage(1);

  return (
    <div>
      <PageHeader
        title="Списания"
        actions={<button type="button" className={buttonPrimary} onClick={() => setCreating(true)}>Новое списание</button>}
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <select aria-label="Статус" className={`${inputClass} max-w-48`} value={status} onChange={(e) => { setStatus(e.target.value); resetPage(); }}>
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

      {creating && (
        <CrudModal
          title="Новое списание"
          schema={writeOffSchema}
          defaultValues={toWriteOffForm(null)}
          onSubmit={async (values) => {
            const writeOff = (await writeOffs.create(values)) as unknown as WriteOff;
            router.push(`/write-offs/${writeOff.id}`);
          }}
          onClose={() => setCreating(false)}
        >
          {(form) => <WriteOffFields form={form} />}
        </CrudModal>
      )}
    </div>
  );
}
