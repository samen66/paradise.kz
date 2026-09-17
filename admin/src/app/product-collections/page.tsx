'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useResource } from '@/lib/crud';
import { ru } from '@/lib/text';
import { CollectionFields, collectionSchema, toCollectionForm, type Collection } from '@/components/collections/CollectionForm';
import ConfirmButton from '@/components/ui/ConfirmButton';
import CrudModal from '@/components/ui/CrudModal';
import DataTable, { type Column } from '@/components/ui/DataTable';
import PageHeader from '@/components/ui/PageHeader';
import { buttonLink, buttonPrimary } from '@/components/ui/styles';

export default function ProductCollectionsPage() {
  const router = useRouter();
  const collections = useResource<Collection>('/admin/product-collections');
  const [creating, setCreating] = useState(false);

  const columns: Column<Collection>[] = [
    {
      key: 'title',
      header: 'Заголовок',
      render: (c) => (
        <Link href={`/product-collections/${c.id}`} className="font-medium text-zinc-900 hover:text-blue-700">
          {ru(c.title) || '—'}
        </Link>
      ),
    },
    { key: 'slug', header: 'Slug', render: (c) => c.slug },
    { key: 'products', header: 'Товаров', render: (c) => c.products_count ?? 0 },
    { key: 'sort', header: 'Порядок', render: (c) => c.sort_order },
    { key: 'active', header: 'Статус', render: (c) => (c.is_active ? 'Показана' : 'Скрыта') },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (c) => (
        <div className="flex justify-end gap-4">
          <Link href={`/product-collections/${c.id}`} className={buttonLink}>Открыть</Link>
          <ConfirmButton onConfirm={() => collections.remove(c.id)}>Удалить</ConfirmButton>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Подборки"
        actions={<button type="button" className={buttonPrimary} onClick={() => setCreating(true)}>Добавить подборку</button>}
      />
      <DataTable columns={columns} rows={collections.items} loading={collections.loading} emptyText="Подборок пока нет" />

      {creating && (
        <CrudModal
          title="Новая подборка"
          schema={collectionSchema}
          defaultValues={toCollectionForm(null)}
          onSubmit={async (values) => {
            const collection = await collections.create(values);
            router.push(`/product-collections/${collection.id}`);
          }}
          onClose={() => setCreating(false)}
        >
          {(form) => <CollectionFields form={form} />}
        </CrudModal>
      )}
    </div>
  );
}
