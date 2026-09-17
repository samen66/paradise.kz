'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { serverMessage } from '@/lib/errors';
import { productLabel, ru, type ProductRef } from '@/lib/text';
import { toast } from '@/stores/toastStore';
import { CollectionFields, collectionSchema, toCollectionForm, type Collection } from '@/components/collections/CollectionForm';
import ConfirmButton from '@/components/ui/ConfirmButton';
import CrudModal from '@/components/ui/CrudModal';
import DataTable, { type Column } from '@/components/ui/DataTable';
import EntityPicker from '@/components/ui/EntityPicker';
import PageHeader from '@/components/ui/PageHeader';
import { buttonSecondary, inputClass } from '@/components/ui/styles';

type CollectionProduct = ProductRef & { pivot: { sort_order: number } };
type CollectionDetail = Collection & { products: CollectionProduct[] };

export default function ProductCollectionPage() {
  const { id } = useParams<{ id: string }>();
  const base = `/admin/product-collections/${id}`;
  const [collection, setCollection] = useState<CollectionDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ data: CollectionDetail }>(base);
      setCollection(res.data.data);
    } catch {
      setNotFound(true);
    }
  }, [base]);

  useEffect(() => {
    // Fetch-on-mount: load() synchronizes with the API, an external system,
    // which is exactly what an effect is for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const place = async (productId: number, sortOrder: number, message?: string) => {
    try {
      await api.put(`${base}/products/${productId}`, { sort_order: sortOrder });
      if (message) {
        toast.success(message);
      }
      await load();
    } catch (error) {
      toast.error(serverMessage(error) ?? 'Не удалось сохранить порядок');
    }
  };

  if (notFound) {
    return (
      <div className="space-y-4">
        <p className="text-zinc-500">Подборка не найдена</p>
        <Link href="/product-collections" className={buttonSecondary}>← К списку подборок</Link>
      </div>
    );
  }

  if (!collection) {
    return <div className="text-zinc-500">Загрузка…</div>;
  }

  const nextOrder = Math.max(0, ...collection.products.map((p) => p.pivot.sort_order)) + 1;

  const columns: Column<CollectionProduct>[] = [
    {
      key: 'order',
      header: 'Порядок',
      className: 'w-28',
      render: (p) => (
        <input
          type="number"
          aria-label={`Порядок: ${productLabel(p)}`}
          defaultValue={p.pivot.sort_order}
          className={inputClass}
          onBlur={(e) => {
            const value = Number(e.target.value);
            if (Number.isInteger(value) && value !== p.pivot.sort_order) {
              void place(p.id, value, 'Порядок сохранён');
            }
          }}
        />
      ),
    },
    { key: 'name', header: 'Товар', render: (p) => productLabel(p) },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (p) => (
        <ConfirmButton
          question="Убрать товар из подборки?"
          onConfirm={async () => {
            try {
              await api.delete(`${base}/products/${p.id}`);
              toast.success('Товар убран из подборки');
              await load();
            } catch (error) {
              toast.error(serverMessage(error) ?? 'Не удалось убрать товар');
            }
          }}
        >
          Убрать
        </ConfirmButton>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={ru(collection.title) || 'Подборка'}
        back="/product-collections"
        actions={<button type="button" className={buttonSecondary} onClick={() => setEditing(true)}>Изменить</button>}
      />
      <EntityPicker<ProductRef>
        searchPath="/admin/products"
        placeholder="Добавить товар: название или код"
        label={productLabel}
        excludeIds={collection.products.map((p) => p.id)}
        onPick={(p) => place(p.id, nextOrder, 'Товар добавлен')}
      />
      <DataTable
        columns={columns}
        rows={collection.products}
        emptyText="В подборке нет товаров"
        rowKey={(p) => `${p.id}-${p.pivot.sort_order}`}
      />

      {editing && (
        <CrudModal
          title="Изменить подборку"
          schema={collectionSchema}
          defaultValues={toCollectionForm(collection)}
          onSubmit={async (values) => {
            await api.put(base, values);
            await load();
          }}
          onClose={() => setEditing(false)}
        >
          {(form) => <CollectionFields form={form} />}
        </CrudModal>
      )}
    </div>
  );
}
