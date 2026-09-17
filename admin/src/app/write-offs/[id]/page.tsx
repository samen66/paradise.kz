'use client';

import { isAxiosError } from 'axios';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import api from '@/lib/api';
import { useResource } from '@/lib/crud';
import { serverMessage } from '@/lib/errors';
import { formatTenge } from '@/lib/money';
import { productLabel, type ProductRef } from '@/lib/text';
import { formatDateTime, formatQty, WRITE_OFF_REASONS, type WriteOff, type WriteOffItem } from '@/lib/warehouse';
import { toast } from '@/stores/toastStore';
import ConfirmButton from '@/components/ui/ConfirmButton';
import CrudModal from '@/components/ui/CrudModal';
import DataTable, { type Column } from '@/components/ui/DataTable';
import EntityPicker from '@/components/ui/EntityPicker';
import Field from '@/components/ui/Field';
import PageHeader from '@/components/ui/PageHeader';
import { buttonLink, buttonPrimary, buttonSecondary, cardClass, inputClass } from '@/components/ui/styles';
import DocumentStatusBadge from '@/components/warehouse/DocumentStatusBadge';
import { quantityField } from '@/components/warehouse/QuantityForm';
import { toWriteOffForm, WriteOffFields, writeOffSchema } from '@/components/warehouse/WriteOffForm';

const lineSchema = z.object({ quantity: quantityField });

type LineEditing = { item: WriteOffItem | null; product: ProductRef };

export default function WriteOffPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const base = `/admin/write-offs/${id}`;

  const [writeOff, setWriteOff] = useState<WriteOff | null>(null);
  const [loadError, setLoadError] = useState<'not_found' | 'error' | null>(null);
  const [editingHeader, setEditingHeader] = useState(false);
  const [line, setLine] = useState<LineEditing | null>(null);
  const items = useResource<WriteOffItem>(`${base}/items`);

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ data: WriteOff }>(base);
      setWriteOff(res.data.data);
      setLoadError(null);
    } catch (error) {
      setLoadError(isAxiosError(error) && error.response?.status === 404 ? 'not_found' : 'error');
    }
  }, [base]);

  useEffect(() => {
    // Fetch-on-mount: load() synchronizes with the API, an external system,
    // which is exactly what an effect is for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (loadError === 'not_found') {
    return (
      <div className="space-y-3">
        <p className="text-zinc-700">Списание не найдено.</p>
        <Link href="/write-offs" className={buttonLink}>← К списаниям</Link>
      </div>
    );
  }

  if (loadError === 'error') {
    return (
      <div className="space-y-3">
        <p className="text-zinc-700">Не удалось загрузить списание.</p>
        <button type="button" className={buttonSecondary} onClick={() => void load()}>Повторить</button>
      </div>
    );
  }

  if (!writeOff) {
    return <div className="text-zinc-500">Загрузка…</div>;
  }

  const isDraft = writeOff.status === 'draft';

  const post = async () => {
    try {
      const res = await api.post<{ data: WriteOff }>(`${base}/post`);
      setWriteOff(res.data.data);
      toast.success('Списание проведено');
    } catch (error) {
      const message = serverMessage(error);
      if (message) {
        toast.error(message);
      }
      await load();
    }
    await items.reload();
  };

  const columns: Column<WriteOffItem>[] = [
    { key: 'product', header: 'Товар', render: (i) => productLabel(i.product) },
    {
      key: 'qty',
      header: 'Количество',
      className: 'text-right',
      render: (i) => {
        const short = isDraft && i.available !== undefined && Number(i.quantity) > i.available;
        return <span className={short ? 'font-semibold text-red-600' : ''}>{formatQty(i.quantity)}</span>;
      },
    },
    ...(isDraft
      ? [
          { key: 'available', header: 'Доступно', className: 'text-right', render: (i: WriteOffItem) => formatQty(i.available ?? 0) },
          {
            key: 'actions',
            header: '',
            className: 'text-right',
            render: (i: WriteOffItem) => (
              <div className="flex justify-end gap-4">
                <button type="button" className={buttonLink} onClick={() => setLine({ item: i, product: i.product })}>Изменить</button>
                <ConfirmButton question="Удалить позицию?" onConfirm={() => items.remove(i.id)}>Удалить</ConfirmButton>
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={writeOff.label}
        back="/write-offs"
        actions={
          isDraft ? (
            <>
              <button type="button" className={buttonSecondary} onClick={() => setEditingHeader(true)}>Изменить шапку</button>
              <ConfirmButton
                question="Удалить черновик списания?"
                onConfirm={async () => {
                  await api.delete(base);
                  toast.success('Черновик удалён');
                  router.push('/write-offs');
                }}
              >
                Удалить черновик
              </ConfirmButton>
              <ConfirmButton
                className={buttonPrimary}
                question="Провести списание? Товар уйдёт со склада по FIFO. Необратимо."
                onConfirm={post}
              >
                Провести
              </ConfirmButton>
            </>
          ) : null
        }
      />

      <div className={`${cardClass} grid grid-cols-2 gap-4 p-4 text-sm md:grid-cols-4`}>
        <div><div className="text-zinc-500">Статус</div><DocumentStatusBadge status={writeOff.status} postedLabel="Проведено" /></div>
        <div><div className="text-zinc-500">Склад</div>{writeOff.store.name}</div>
        <div><div className="text-zinc-500">Причина</div>{WRITE_OFF_REASONS[writeOff.reason] ?? writeOff.reason}</div>
        {writeOff.note && <div className="col-span-full"><div className="text-zinc-500">Комментарий</div>{writeOff.note}</div>}
      </div>

      {!isDraft && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <span>
            Проведено {formatDateTime(writeOff.posted_at)}
            {writeOff.user ? `, ${writeOff.user.name}` : ''}
            {' · '}Себестоимость: {formatTenge(writeOff.total_cost)}
          </span>
          <Link href={`/stock-movements?document=write_off:${writeOff.id}`} className={buttonLink}>Движения по этому списанию</Link>
        </div>
      )}

      {isDraft && (
        <EntityPicker<ProductRef>
          searchPath="/admin/products"
          placeholder="Добавить товар: название или код"
          label={productLabel}
          onPick={(product) => setLine({ item: null, product })}
        />
      )}

      <DataTable columns={columns} rows={items.items} loading={items.loading} emptyText="Позиций нет — добавьте товар" />

      {line && (
        <CrudModal
          title={`Позиция: ${productLabel(line.product)}`}
          schema={lineSchema}
          defaultValues={{ quantity: line.item ? String(Number(line.item.quantity)) : '' }}
          onSubmit={(values) =>
            line.item ? items.update(line.item.id, values) : items.create({ ...values, product_id: line.product.id })
          }
          onClose={() => setLine(null)}
        >
          {(form) => (
            <Field label="Количество *" htmlFor="wo-line-qty" error={form.formState.errors.quantity?.message}>
              <input id="wo-line-qty" type="number" step="0.001" min="0" className={inputClass} {...form.register('quantity')} />
            </Field>
          )}
        </CrudModal>
      )}

      {editingHeader && (
        <CrudModal
          title="Шапка списания"
          schema={writeOffSchema}
          defaultValues={toWriteOffForm(writeOff)}
          onSubmit={async (values) => {
            const res = await api.put<{ data: WriteOff }>(base, values);
            setWriteOff(res.data.data);
            // The store may have changed — «Доступно» is per store.
            await items.reload();
          }}
          onClose={() => setEditingHeader(false)}
        >
          {(form) => <WriteOffFields form={form} />}
        </CrudModal>
      )}
    </div>
  );
}
