'use client';

import { isAxiosError } from 'axios';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import api from '@/lib/api';
import { useResource } from '@/lib/crud';
import { serverMessage } from '@/lib/errors';
import { formatTenge, TENGE_PATTERN, tiynToTenge } from '@/lib/money';
import { productLabel, type ProductRef } from '@/lib/text';
import {
  formatDateTime,
  formatQty,
  lineCost,
  warehouseHref,
  type GoodsReceipt,
  type GoodsReceiptItem,
  type Supplier,
} from '@/lib/warehouse';
import { toast } from '@/stores/toastStore';
import ConfirmButton from '@/components/ui/ConfirmButton';
import CrudModal from '@/components/ui/CrudModal';
import DataTable, { type Column } from '@/components/ui/DataTable';
import EntityPicker from '@/components/ui/EntityPicker';
import Field from '@/components/ui/Field';
import MoneyInput from '@/components/ui/MoneyInput';
import PageHeader from '@/components/ui/PageHeader';
import { buttonLink, buttonPrimary, buttonSecondary, cardClass, inputClass } from '@/components/ui/styles';
import DocumentStatusBadge from '@/components/warehouse/DocumentStatusBadge';
import { ReceiptFields, receiptSchema, toReceiptForm, toReceiptPayload } from '@/components/warehouse/GoodsReceiptForm';
import { quantityField } from '@/components/warehouse/QuantityForm';

const lineSchema = z.object({
  quantity: quantityField,
  unit_cost: z.string().regex(TENGE_PATTERN, 'Сумма в ₸, до двух знаков после точки'),
});

type LineEditing = { item: GoodsReceiptItem | null; product: ProductRef };

export default function GoodsReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const base = `/admin/goods-receipts/${id}`;

  const [receipt, setReceipt] = useState<GoodsReceipt | null>(null);
  const [loadError, setLoadError] = useState<'not_found' | 'error' | null>(null);
  const [editingHeader, setEditingHeader] = useState(false);
  const [line, setLine] = useState<LineEditing | null>(null);
  const items = useResource<GoodsReceiptItem>(`${base}/items`);
  const suppliers = useResource<Supplier>('/admin/suppliers');

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ data: GoodsReceipt }>(base);
      setReceipt(res.data.data);
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
        <p className="text-zinc-700">Приёмка не найдена.</p>
        <Link href={warehouseHref.documents('receipts')} className={buttonLink}>← К приёмкам</Link>
      </div>
    );
  }

  if (loadError === 'error') {
    return (
      <div className="space-y-3">
        <p className="text-zinc-700">Не удалось загрузить приёмку.</p>
        <button type="button" className={buttonSecondary} onClick={() => void load()}>Повторить</button>
      </div>
    );
  }

  if (!receipt) {
    return <div className="text-zinc-500">Загрузка…</div>;
  }

  const isDraft = receipt.status === 'draft';
  const total = items.items.reduce((sum, i) => sum + lineCost(i.quantity, i.unit_cost), 0);

  const post = async () => {
    try {
      const res = await api.post<{ data: GoodsReceipt }>(`${base}/post`);
      setReceipt(res.data.data);
      await items.reload();
      toast.success('Приёмка проведена');
    } catch (error) {
      const message = serverMessage(error);
      if (message) {
        toast.error(message);
      }
      await load();
    }
  };

  const columns: Column<GoodsReceiptItem>[] = [
    { key: 'product', header: 'Товар', render: (i) => productLabel(i.product) },
    { key: 'qty', header: 'Количество', className: 'text-right', render: (i) => formatQty(i.quantity) },
    { key: 'cost', header: 'Себестоимость', className: 'text-right', render: (i) => formatTenge(i.unit_cost) },
    { key: 'sum', header: 'Сумма', className: 'text-right', render: (i) => formatTenge(lineCost(i.quantity, i.unit_cost)) },
    ...(isDraft
      ? [
          {
            key: 'actions',
            header: '',
            className: 'text-right',
            render: (i: GoodsReceiptItem) => (
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
        title={`Приёмка ${receipt.number || `№${receipt.id}`}`}
        back={warehouseHref.documents('receipts')}
        actions={
          isDraft ? (
            <>
              <button type="button" className={buttonSecondary} onClick={() => setEditingHeader(true)}>Изменить шапку</button>
              <ConfirmButton
                question="Удалить черновик приёмки?"
                onConfirm={async () => {
                  await api.delete(base);
                  toast.success('Черновик удалён');
                  router.push(warehouseHref.documents('receipts'));
                }}
              >
                Удалить черновик
              </ConfirmButton>
              <ConfirmButton
                className={buttonPrimary}
                question="Провести приёмку? Будут созданы партии и движения по складу. Необратимо."
                onConfirm={post}
              >
                Провести
              </ConfirmButton>
            </>
          ) : null
        }
      />

      <div className={`${cardClass} grid grid-cols-2 gap-4 p-4 text-sm md:grid-cols-4`}>
        <div><div className="text-zinc-500">Статус</div><DocumentStatusBadge status={receipt.status} postedLabel="Проведена" /></div>
        <div><div className="text-zinc-500">Склад</div>{receipt.store.name}</div>
        <div><div className="text-zinc-500">Поставщик</div>{receipt.supplier?.name ?? '—'}</div>
        <div><div className="text-zinc-500">Дата приёмки</div>{formatDateTime(receipt.received_at)}</div>
        {receipt.note && <div className="col-span-full"><div className="text-zinc-500">Комментарий</div>{receipt.note}</div>}
      </div>

      {!isDraft && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <span>
            Проведена {formatDateTime(receipt.posted_at)}
            {receipt.user ? `, ${receipt.user.name}` : ''}
          </span>
          <Link href={`${warehouseHref.movements}?document=receipt:${receipt.id}`} className={buttonLink}>Движения по этой приёмке</Link>
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
      <div className="text-right text-sm text-zinc-700">
        Итого: <span className="font-semibold text-zinc-900">{formatTenge(total)}</span>
      </div>

      {line && (
        <CrudModal
          title={`Позиция: ${productLabel(line.product)}`}
          schema={lineSchema}
          defaultValues={{
            quantity: line.item ? String(Number(line.item.quantity)) : '',
            unit_cost: tiynToTenge(line.item?.unit_cost),
          }}
          onSubmit={(values) =>
            line.item ? items.update(line.item.id, values) : items.create({ ...values, product_id: line.product.id })
          }
          onClose={() => setLine(null)}
        >
          {(form) => (
            <>
              <Field label="Количество *" htmlFor="line-qty" error={form.formState.errors.quantity?.message}>
                <input id="line-qty" type="number" step="0.001" min="0" className={inputClass} {...form.register('quantity')} />
              </Field>
              <Field label="Себестоимость, ₸ *" htmlFor="line-cost" error={form.formState.errors.unit_cost?.message}>
                <MoneyInput id="line-cost" {...form.register('unit_cost')} />
              </Field>
            </>
          )}
        </CrudModal>
      )}

      {editingHeader && (
        <CrudModal
          title="Шапка приёмки"
          schema={receiptSchema}
          defaultValues={toReceiptForm(receipt)}
          onSubmit={async (values) => {
            const res = await api.put<{ data: GoodsReceipt }>(base, toReceiptPayload(values));
            setReceipt(res.data.data);
          }}
          onClose={() => setEditingHeader(false)}
        >
          {(form) => <ReceiptFields form={form} suppliers={suppliers.items} />}
        </CrudModal>
      )}
    </div>
  );
}
