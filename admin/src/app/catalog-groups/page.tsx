'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
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

type CatalogGroup = { id: number; name: string; products_count: number; users_count: number };

const schema = z.object({ name: z.string().min(1, REQUIRED).max(255) });

export default function CatalogGroupsPage() {
  const router = useRouter();
  const groups = useResource<CatalogGroup>('/admin/catalog-groups');
  const [creating, setCreating] = useState(false);

  const columns: Column<CatalogGroup>[] = [
    {
      key: 'name',
      header: 'Название',
      render: (g) => (
        <Link href={`/catalog-groups/${g.id}`} className="font-medium text-zinc-900 hover:text-blue-700">
          {g.name}
        </Link>
      ),
    },
    { key: 'products', header: 'Товаров', render: (g) => g.products_count },
    { key: 'users', header: 'Клиентов', render: (g) => g.users_count },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (g) => (
        <div className="flex justify-end gap-4">
          <Link href={`/catalog-groups/${g.id}`} className={buttonLink}>Открыть</Link>
          <ConfirmButton onConfirm={() => groups.remove(g.id)}>Удалить</ConfirmButton>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Группы каталога"
        actions={<button type="button" className={buttonPrimary} onClick={() => setCreating(true)}>Добавить группу</button>}
      />
      <p className="mb-4 text-sm text-zinc-500">
        Товар в любой группе пропадает с витрины и виден только B2B-клиентам этой группы.
      </p>
      <DataTable columns={columns} rows={groups.items} loading={groups.loading} emptyText="Групп пока нет" />

      {creating && (
        <CrudModal
          title="Новая группа"
          schema={schema}
          defaultValues={{ name: '' }}
          onSubmit={async (values) => {
            const group = await groups.create(values);
            router.push(`/catalog-groups/${group.id}`);
          }}
          onClose={() => setCreating(false)}
        >
          {(form) => (
            <Field label="Название *" htmlFor="group-name" error={form.formState.errors.name?.message}>
              <input id="group-name" className={inputClass} {...form.register('name')} />
            </Field>
          )}
        </CrudModal>
      )}
    </div>
  );
}
