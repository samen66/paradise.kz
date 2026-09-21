'use client';

import { useState } from 'react';
import { z } from 'zod';
import { useResource } from '@/lib/crud';
import { formatTenge, TENGE_PATTERN, tiynToTenge } from '@/lib/money';
import { REQUIRED } from '@/lib/validation';
import ConfirmButton from '@/components/ui/ConfirmButton';
import CrudModal from '@/components/ui/CrudModal';
import DataTable, { type Column } from '@/components/ui/DataTable';
import Field from '@/components/ui/Field';
import MoneyInput from '@/components/ui/MoneyInput';
import { buttonLink, buttonPrimary, inputClass } from '@/components/ui/styles';

type Variant = {
  id: number;
  name: string;
  code: string | null;
  retail_price: number | null;
  b2b_price: number | null;
  stock: string;
  barcodes: string[] | null;
  characteristics: Record<string, string> | null;
};

const optionalTenge = z.string().refine((v) => v === '' || TENGE_PATTERN.test(v), 'Сумма в ₸, до двух знаков после точки');

const schema = z.object({
  name: z.string().min(1, REQUIRED).max(255),
  code: z.string().max(255),
  retail_price: optionalTenge,
  b2b_price: optionalTenge,
  barcodes: z.string(),
  characteristics: z.string().refine(
    (v) => v.split('\n').every((line) => line.trim() === '' || line.includes(':')),
    'Каждая строка — «Название: значение»',
  ),
});

type VariantForm = z.infer<typeof schema>;

const toForm = (v: Variant | null): VariantForm => ({
  name: v?.name ?? '',
  code: v?.code ?? '',
  retail_price: tiynToTenge(v?.retail_price),
  b2b_price: tiynToTenge(v?.b2b_price),
  barcodes: (v?.barcodes ?? []).join('\n'),
  characteristics: Object.entries(v?.characteristics ?? {})
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n'),
});

/** Textareas are one-per-line; the API takes an array and an object. */
const toPayload = (f: VariantForm) => ({
  name: f.name,
  code: f.code,
  retail_price: f.retail_price,
  b2b_price: f.b2b_price,
  barcodes: f.barcodes.split('\n').map((s) => s.trim()).filter(Boolean),
  characteristics: Object.fromEntries(
    f.characteristics
      .split('\n')
      .filter((line) => line.includes(':'))
      .map((line) => {
        const at = line.indexOf(':');
        return [line.slice(0, at).trim(), line.slice(at + 1).trim()];
      }),
  ),
});

export default function VariantsTab({ productId }: { productId: number }) {
  const variants = useResource<Variant>(`/admin/products/${productId}/variants`);
  const [editing, setEditing] = useState<Variant | null | undefined>(undefined);

  const columns: Column<Variant>[] = [
    { key: 'name', header: 'Вариант', render: (v) => <span className="font-medium text-zinc-900">{v.name}</span> },
    { key: 'code', header: 'Код', render: (v) => v.code ?? '—' },
    { key: 'retail', header: 'Розница', render: (v) => formatTenge(v.retail_price) },
    { key: 'b2b', header: 'Опт', render: (v) => formatTenge(v.b2b_price) },
    { key: 'stock', header: 'Остаток', render: (v) => Number(v.stock) },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (v) => (
        <div className="flex justify-end gap-4">
          <button type="button" className={buttonLink} onClick={() => setEditing(v)}>Изменить</button>
          <ConfirmButton onConfirm={() => variants.remove(v.id)}>Удалить</ConfirmButton>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <button type="button" className={buttonPrimary} onClick={() => setEditing(null)}>Добавить вариант</button>
      <DataTable columns={columns} rows={variants.items} loading={variants.loading} emptyText="Вариантов нет" />

      {editing !== undefined && (
        <CrudModal
          title={editing ? 'Изменить вариант' : 'Новый вариант'}
          schema={schema}
          defaultValues={toForm(editing)}
          onSubmit={(f) => (editing ? variants.update(editing.id, toPayload(f)) : variants.create(toPayload(f)))}
          onClose={() => setEditing(undefined)}
        >
          {(form) => {
            const { errors } = form.formState;
            return (
              <>
                <Field label="Название *" htmlFor="v-name" error={errors.name?.message}>
                  <input id="v-name" className={inputClass} {...form.register('name')} />
                </Field>
                <Field label="Код" htmlFor="v-code" error={errors.code?.message}>
                  <input id="v-code" className={inputClass} {...form.register('code')} />
                </Field>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Розничная цена, ₸" htmlFor="v-retail" error={errors.retail_price?.message}>
                    <MoneyInput id="v-retail" {...form.register('retail_price')} />
                  </Field>
                  <Field label="Оптовая цена, ₸" htmlFor="v-b2b" error={errors.b2b_price?.message}>
                    <MoneyInput id="v-b2b" {...form.register('b2b_price')} />
                  </Field>
                </div>
                <Field label="Штрихкоды" htmlFor="v-barcodes" hint="По одному на строку" error={errors.barcodes?.message}>
                  <textarea id="v-barcodes" rows={2} className={inputClass} {...form.register('barcodes')} />
                </Field>
                <Field label="Характеристики" htmlFor="v-chars" hint="«Цвет: Серый» — по одной на строку" error={errors.characteristics?.message}>
                  <textarea id="v-chars" rows={3} className={inputClass} {...form.register('characteristics')} />
                </Field>
                <p className="text-xs text-zinc-500">Остаток варианта здесь не меняется — только приёмками и заказами.</p>
              </>
            );
          }}
        </CrudModal>
      )}
    </div>
  );
}
