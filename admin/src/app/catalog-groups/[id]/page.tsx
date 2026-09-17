'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import { z } from 'zod';
import api from '@/lib/api';
import { serverMessage } from '@/lib/errors';
import { clientLabel, productLabel, type ClientRef, type ProductRef } from '@/lib/text';
import { REQUIRED } from '@/lib/validation';
import { toast } from '@/stores/toastStore';
import ConfirmButton from '@/components/ui/ConfirmButton';
import CrudModal from '@/components/ui/CrudModal';
import DataTable, { type Column } from '@/components/ui/DataTable';
import EntityPicker from '@/components/ui/EntityPicker';
import Field from '@/components/ui/Field';
import PageHeader from '@/components/ui/PageHeader';
import Tabs from '@/components/ui/Tabs';
import { buttonSecondary, inputClass } from '@/components/ui/styles';

type GroupDetail = { id: number; name: string; products: ProductRef[]; users: ClientRef[] };

const schema = z.object({ name: z.string().min(1, REQUIRED).max(255) });

export default function CatalogGroupPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const base = `/admin/catalog-groups/${id}`;
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [loadError, setLoadError] = useState<'not_found' | 'error' | null>(null);
  const [renaming, setRenaming] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ data: GroupDetail }>(base);
      setGroup(res.data.data);
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

  const change = async (request: Promise<unknown>, message: string) => {
    try {
      await request;
      toast.success(message);
      await load();
    } catch (error) {
      toast.error(serverMessage(error) ?? 'Не удалось выполнить действие');
    }
  };

  if (loadError === 'not_found') {
    return (
      <div className="space-y-4">
        <p className="text-zinc-500">Группа не найдена</p>
        <Link href="/catalog-groups" className={buttonSecondary}>← К списку групп</Link>
      </div>
    );
  }

  if (loadError === 'error') {
    return (
      <div className="space-y-4">
        <p className="text-zinc-500">Не удалось загрузить группу</p>
        <button type="button" className={buttonSecondary} onClick={() => void load()}>Повторить</button>
      </div>
    );
  }

  if (!group) {
    return <div className="text-zinc-500">Загрузка…</div>;
  }

  const productColumns: Column<ProductRef>[] = [
    { key: 'name', header: 'Товар', render: (p) => productLabel(p) },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (p) => (
        <ConfirmButton question="Убрать товар из группы? Он вернётся на витрину, если не состоит в других группах." onConfirm={() => change(api.delete(`${base}/products/${p.id}`), 'Товар убран из группы')}>
          Убрать
        </ConfirmButton>
      ),
    },
  ];

  const clientColumns: Column<ClientRef>[] = [
    { key: 'name', header: 'Клиент', render: (c) => clientLabel(c) },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (c) => (
        <ConfirmButton question="Убрать клиента из группы?" onConfirm={() => change(api.delete(`${base}/users/${c.id}`), 'Клиент убран из группы')}>
          Убрать
        </ConfirmButton>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={group.name}
        back="/catalog-groups"
        actions={
          <>
            <button type="button" className={buttonSecondary} onClick={() => setRenaming(true)}>Переименовать</button>
            <ConfirmButton
              question="Удалить группу? Её товары вернутся на витрину, клиенты потеряют доступ к ним."
              onConfirm={async () => {
                try {
                  await api.delete(base);
                  toast.success('Группа удалена');
                  router.push('/catalog-groups');
                } catch (error) {
                  toast.error(serverMessage(error) ?? 'Не удалось удалить группу');
                }
              }}
            >
              Удалить группу
            </ConfirmButton>
          </>
        }
      />

      <Tabs
        tabs={[
          {
            key: 'products',
            label: `Товары (${group.products.length})`,
            content: (
              <div className="space-y-4">
                <EntityPicker<ProductRef>
                  searchPath="/admin/products"
                  placeholder="Найти товар по названию или коду"
                  label={productLabel}
                  excludeIds={group.products.map((p) => p.id)}
                  onPick={(p) => change(api.post(`${base}/products/${p.id}`), 'Товар добавлен в группу')}
                />
                <DataTable columns={productColumns} rows={group.products} emptyText="В группе нет товаров" />
              </div>
            ),
          },
          {
            key: 'users',
            label: `Клиенты (${group.users.length})`,
            content: (
              <div className="space-y-4">
                <EntityPicker<ClientRef>
                  searchPath="/admin/users"
                  placeholder="Найти B2B-клиента по компании, БИН, телефону"
                  label={clientLabel}
                  excludeIds={group.users.map((c) => c.id)}
                  onPick={(c) => change(api.post(`${base}/users/${c.id}`), 'Клиент добавлен в группу')}
                />
                <DataTable columns={clientColumns} rows={group.users} emptyText="В группе нет клиентов" />
              </div>
            ),
          },
        ]}
      />

      {renaming && (
        <CrudModal
          title="Переименовать группу"
          schema={schema}
          defaultValues={{ name: group.name }}
          onSubmit={async (values) => {
            await api.put(base, values);
            await load();
          }}
          onClose={() => setRenaming(false)}
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
