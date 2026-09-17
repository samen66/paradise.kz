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

type Category = { id: number; name: { ru?: string; kk?: string }; slug: string; is_active: boolean };

const schema = z.object({
  name: translatable,
  slug: z.string().min(1, REQUIRED).max(255),
  is_active: z.boolean(),
});

type CategoryForm = z.infer<typeof schema>;

const toForm = (category: Category | null): CategoryForm => ({
  name: { ru: category?.name?.ru ?? '', kk: category?.name?.kk ?? '' },
  slug: category?.slug ?? '',
  is_active: category?.is_active ?? true,
});

export default function CategoriesPage() {
  const categories = useResource<Category>('/admin/categories');
  const [editing, setEditing] = useState<Category | null | undefined>(undefined);

  const columns: Column<Category>[] = [
    { key: 'id', header: 'ID', render: (c) => c.id },
    { key: 'name', header: 'Название', render: (c) => <span className="font-medium text-zinc-900">{c.name?.ru || '—'}</span> },
    { key: 'slug', header: 'Slug', render: (c) => c.slug },
    { key: 'status', header: 'Статус', render: (c) => (c.is_active ? 'Активна' : 'Выключена') },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (c) => (
        <div className="flex justify-end gap-4">
          <button type="button" className={buttonLink} onClick={() => setEditing(c)}>Изменить</button>
          <ConfirmButton onConfirm={() => categories.remove(c.id)}>Удалить</ConfirmButton>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Категории"
        actions={<button type="button" className={buttonPrimary} onClick={() => setEditing(null)}>Добавить категорию</button>}
      />
      <DataTable columns={columns} rows={categories.items} loading={categories.loading} emptyText="Категорий пока нет" />

      {editing !== undefined && (
        <CrudModal
          title={editing ? 'Изменить категорию' : 'Новая категория'}
          schema={schema}
          defaultValues={toForm(editing)}
          onSubmit={(values) => (editing ? categories.update(editing.id, values) : categories.create(values))}
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
                Активна
              </label>
            </>
          )}
        </CrudModal>
      )}
    </div>
  );
}
