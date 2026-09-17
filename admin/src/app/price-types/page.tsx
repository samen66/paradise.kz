'use client';

import { useState } from 'react';
import { z } from 'zod';
import { useResource } from '@/lib/crud';
import { REQUIRED } from '@/lib/validation';
import ConfirmButton from '@/components/ui/ConfirmButton';
import CrudModal from '@/components/ui/CrudModal';
import DataTable, { type Column } from '@/components/ui/DataTable';
import Field from '@/components/ui/Field';
import PageHeader from '@/components/ui/PageHeader';
import { buttonLink, buttonPrimary, inputClass } from '@/components/ui/styles';
import type { PriceType } from '@/lib/catalogTypes';

const schema = z.object({
  code: z.string().regex(/^[a-z0-9_]+$/, 'Латиница в нижнем регистре, цифры и _'),
  name: z.string().min(1, REQUIRED).max(255),
  sort_order: z.string().regex(/^\d*$/, 'Целое число'),
});

type PriceTypeForm = z.infer<typeof schema>;

const toForm = (t: PriceType | null): PriceTypeForm => ({
  code: t?.code ?? '',
  name: t?.name ?? '',
  sort_order: t ? String(t.sort_order) : '0',
});

export default function PriceTypesPage() {
  const types = useResource<PriceType>('/admin/price-types');
  const [editing, setEditing] = useState<PriceType | null | undefined>(undefined);

  const columns: Column<PriceType>[] = [
    { key: 'name', header: 'Название', render: (t) => <span className="font-medium text-zinc-900">{t.name}</span> },
    { key: 'code', header: 'Код', render: (t) => <code className="text-xs">{t.code}</code> },
    { key: 'sort', header: 'Порядок', render: (t) => t.sort_order },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (t) => (
        <div className="flex justify-end gap-4">
          <button type="button" className={buttonLink} onClick={() => setEditing(t)}>Изменить</button>
          <ConfirmButton onConfirm={() => types.remove(t.id)}>Удалить</ConfirmButton>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Типы цен"
        actions={<button type="button" className={buttonPrimary} onClick={() => setEditing(null)}>Добавить тип цены</button>}
      />
      <p className="mb-4 text-sm text-zinc-500">
        Код используется в расчёте цен — меняйте его, только если понимаете, где он задействован.
      </p>
      <DataTable columns={columns} rows={types.items} loading={types.loading} emptyText="Типов цен пока нет" />

      {editing !== undefined && (
        <CrudModal
          title={editing ? 'Изменить тип цены' : 'Новый тип цены'}
          schema={schema}
          defaultValues={toForm(editing)}
          onSubmit={(values) => (editing ? types.update(editing.id, values) : types.create(values))}
          onClose={() => setEditing(undefined)}
        >
          {(form) => (
            <>
              <Field label="Название *" htmlFor="pt-name" error={form.formState.errors.name?.message}>
                <input id="pt-name" className={inputClass} {...form.register('name')} />
              </Field>
              <Field label="Код *" htmlFor="pt-code" error={form.formState.errors.code?.message}>
                <input id="pt-code" className={inputClass} {...form.register('code')} />
              </Field>
              <Field label="Порядок" htmlFor="pt-sort" error={form.formState.errors.sort_order?.message}>
                <input id="pt-sort" type="number" min="0" className={inputClass} {...form.register('sort_order')} />
              </Field>
            </>
          )}
        </CrudModal>
      )}
    </div>
  );
}
