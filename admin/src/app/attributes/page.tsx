'use client';

import { useState } from 'react';
import { z } from 'zod';
import { useResource } from '@/lib/crud';
import { REQUIRED, SLUG_PATTERN } from '@/lib/validation';
import ConfirmButton from '@/components/ui/ConfirmButton';
import CrudModal from '@/components/ui/CrudModal';
import DataTable, { type Column } from '@/components/ui/DataTable';
import Field from '@/components/ui/Field';
import PageHeader from '@/components/ui/PageHeader';
import { buttonLink, buttonPrimary, inputClass } from '@/components/ui/styles';
import type { Attribute } from '@/lib/catalogTypes';

const schema = z.object({
  name: z.string().min(1, REQUIRED).max(255),
  slug: z.string().regex(SLUG_PATTERN, 'Латиница в нижнем регистре, цифры и дефисы'),
  is_filterable: z.boolean(),
});

type AttributeForm = z.infer<typeof schema>;

const toForm = (a: Attribute | null): AttributeForm => ({
  name: a?.name ?? '',
  slug: a?.slug ?? '',
  is_filterable: a?.is_filterable ?? false,
});

export default function AttributesPage() {
  const attributes = useResource<Attribute>('/admin/attributes');
  const [editing, setEditing] = useState<Attribute | null | undefined>(undefined);

  const columns: Column<Attribute>[] = [
    { key: 'name', header: 'Название', render: (a) => <span className="font-medium text-zinc-900">{a.name}</span> },
    { key: 'slug', header: 'Slug', render: (a) => a.slug },
    { key: 'filterable', header: 'В фильтрах', render: (a) => (a.is_filterable ? 'Да' : 'Нет') },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (a) => (
        <div className="flex justify-end gap-4">
          <button type="button" className={buttonLink} onClick={() => setEditing(a)}>Изменить</button>
          <ConfirmButton onConfirm={() => attributes.remove(a.id)}>Удалить</ConfirmButton>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Атрибуты"
        actions={<button type="button" className={buttonPrimary} onClick={() => setEditing(null)}>Добавить атрибут</button>}
      />
      <DataTable columns={columns} rows={attributes.items} loading={attributes.loading} emptyText="Атрибутов пока нет" />

      {editing !== undefined && (
        <CrudModal
          title={editing ? 'Изменить атрибут' : 'Новый атрибут'}
          schema={schema}
          defaultValues={toForm(editing)}
          onSubmit={(values) => (editing ? attributes.update(editing.id, values) : attributes.create(values))}
          onClose={() => setEditing(undefined)}
        >
          {(form) => (
            <>
              <Field label="Название *" htmlFor="attr-name" error={form.formState.errors.name?.message}>
                <input id="attr-name" className={inputClass} {...form.register('name')} />
              </Field>
              <Field label="Slug *" htmlFor="attr-slug" error={form.formState.errors.slug?.message}>
                <input id="attr-slug" className={inputClass} {...form.register('slug')} />
              </Field>
              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input type="checkbox" {...form.register('is_filterable')} />
                Показывать в фильтрах витрины
              </label>
            </>
          )}
        </CrudModal>
      )}
    </div>
  );
}
