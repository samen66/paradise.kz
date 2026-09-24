'use client';

import { useEffect, useState } from 'react';
import { z } from 'zod';
import type { PriceType } from '@/lib/catalogTypes';
import { useResource } from '@/lib/crud';
import { formatTenge, TENGE_PATTERN, tiynToTenge } from '@/lib/money';
import { REQUIRED } from '@/lib/validation';
import ConfirmButton from '@/components/ui/ConfirmButton';
import CrudModal from '@/components/ui/CrudModal';
import DataTable, { type Column } from '@/components/ui/DataTable';
import Field from '@/components/ui/Field';
import MoneyInput from '@/components/ui/MoneyInput';
import { buttonLink, buttonPrimary, inputClass } from '@/components/ui/styles';

type Price = { id: number; price_type_id: number; price: number; price_type: PriceType };

const schema = z.object({
  price_type_id: z.string().min(1, REQUIRED),
  price: z.string().regex(TENGE_PATTERN, 'Сумма в ₸, до двух знаков после точки'),
});

export default function PricesTab({ productId, onCount }: { productId: number; onCount?: (count: number) => void }) {
  const prices = useResource<Price>(`/admin/products/${productId}/prices`);

  // Счётчик для заголовка блока — только когда список уже загружен.
  useEffect(() => {
    if (!prices.loading) {
      onCount?.(prices.items.length);
    }
  }, [prices.loading, prices.items.length, onCount]);
  const types = useResource<PriceType>('/admin/price-types');
  const [editing, setEditing] = useState<Price | null | undefined>(undefined);

  const columns: Column<Price>[] = [
    { key: 'type', header: 'Тип цены', render: (p) => p.price_type?.name ?? `#${p.price_type_id}` },
    { key: 'price', header: 'Цена', render: (p) => formatTenge(p.price) },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (p) => (
        <div className="flex justify-end gap-4">
          <button type="button" className={buttonLink} onClick={() => setEditing(p)}>Изменить</button>
          <ConfirmButton onConfirm={() => prices.remove(p.id)}>Удалить</ConfirmButton>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <button type="button" className={buttonPrimary} onClick={() => setEditing(null)}>Добавить цену</button>
      <DataTable columns={columns} rows={prices.items} loading={prices.loading} emptyText="Цен по типам нет" />

      {editing !== undefined && (
        <CrudModal
          title={editing ? 'Изменить цену' : 'Новая цена'}
          schema={schema}
          defaultValues={{ price_type_id: editing ? String(editing.price_type_id) : '', price: tiynToTenge(editing?.price) }}
          onSubmit={(values) => (editing ? prices.update(editing.id, values) : prices.create(values))}
          onClose={() => setEditing(undefined)}
        >
          {(form) => (
            <>
              <Field label="Тип цены *" htmlFor="price-type" error={form.formState.errors.price_type_id?.message}>
                <select id="price-type" className={inputClass} {...form.register('price_type_id')}>
                  <option value="">Выберите тип</option>
                  {types.items.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Цена, ₸ *" htmlFor="price-value" error={form.formState.errors.price?.message}>
                <MoneyInput id="price-value" {...form.register('price')} />
              </Field>
            </>
          )}
        </CrudModal>
      )}
    </div>
  );
}
