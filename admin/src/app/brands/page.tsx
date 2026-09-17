'use client';

import { useState } from 'react';
import { z } from 'zod';
import { useResource } from '@/lib/crud';
import { REQUIRED, translatable } from '@/lib/validation';
import ConfirmButton from '@/components/ui/ConfirmButton';
import CrudModal from '@/components/ui/CrudModal';
import DataTable, { type Column } from '@/components/ui/DataTable';
import Field from '@/components/ui/Field';
import PageHeader from '@/components/ui/PageHeader';
import TranslatableField from '@/components/ui/TranslatableField';
import { buttonLink, buttonPrimary, inputClass } from '@/components/ui/styles';

type Brand = { id: number; name: { ru?: string; kk?: string }; slug: string; is_active: boolean };

const schema = z.object({
  name: translatable,
  slug: z.string().min(1, REQUIRED).max(255),
  is_active: z.boolean(),
});

type BrandForm = z.infer<typeof schema>;

const toForm = (brand: Brand | null): BrandForm => ({
  name: { ru: brand?.name?.ru ?? '', kk: brand?.name?.kk ?? '' },
  slug: brand?.slug ?? '',
  is_active: brand?.is_active ?? true,
});

export default function BrandsPage() {
  const brands = useResource<Brand>('/admin/brands');
  // undefined — modal closed, null — creating.
  const [editing, setEditing] = useState<Brand | null | undefined>(undefined);

  const columns: Column<Brand>[] = [
    { key: 'id', header: 'ID', render: (b) => b.id },
    { key: 'name', header: 'Название', render: (b) => <span className="font-medium text-zinc-900">{b.name?.ru || '—'}</span> },
    { key: 'slug', header: 'Slug', render: (b) => b.slug },
    { key: 'status', header: 'Статус', render: (b) => (b.is_active ? 'Активен' : 'Выключен') },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (b) => (
        <div className="flex justify-end gap-4">
          <button type="button" className={buttonLink} onClick={() => setEditing(b)}>Изменить</button>
          <ConfirmButton onConfirm={() => brands.remove(b.id)}>Удалить</ConfirmButton>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Бренды"
        actions={<button type="button" className={buttonPrimary} onClick={() => setEditing(null)}>Добавить бренд</button>}
      />
      <DataTable columns={columns} rows={brands.items} loading={brands.loading} emptyText="Брендов пока нет" />

      {editing !== undefined && (
        <CrudModal
          title={editing ? 'Изменить бренд' : 'Новый бренд'}
          schema={schema}
          defaultValues={toForm(editing)}
          onSubmit={(values) => (editing ? brands.update(editing.id, values) : brands.create(values))}
          onClose={() => setEditing(undefined)}
        >
          {(form) => (
            <>
              <TranslatableField form={form} name="name" label="Название" required />
              <Field label="Slug *" htmlFor="slug" error={form.formState.errors.slug?.message}>
                <input id="slug" className={inputClass} {...form.register('slug')} />
              </Field>
              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input type="checkbox" {...form.register('is_active')} />
                Активен
              </label>
            </>
          )}
        </CrudModal>
      )}
    </div>
  );
}
