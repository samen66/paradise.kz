'use client';

import { useState } from 'react';
import { z } from 'zod';
import { useResource } from '@/lib/crud';
import { REQUIRED } from '@/lib/validation';
import { STORE_TYPES, type Store } from '@/lib/warehouse';
import ConfirmButton from '@/components/ui/ConfirmButton';
import CrudModal from '@/components/ui/CrudModal';
import DataTable, { type Column } from '@/components/ui/DataTable';
import Field from '@/components/ui/Field';
import PageHeader from '@/components/ui/PageHeader';
import { buttonLink, buttonPrimary, inputClass } from '@/components/ui/styles';

const schema = z.object({
  name: z.string().min(1, REQUIRED).max(255),
  code: z.string().max(64),
  type: z.enum(['warehouse', 'retail_point']),
  address: z.string().max(255),
  is_active: z.boolean(),
  is_default: z.boolean(),
});

type StoreForm = z.infer<typeof schema>;

const toForm = (s: Store | null): StoreForm => ({
  name: s?.name ?? '',
  code: s?.code ?? '',
  type: s?.type ?? 'warehouse',
  address: s?.address ?? '',
  is_active: s?.is_active ?? true,
  is_default: s?.is_default ?? false,
});

export default function StoresPage() {
  const stores = useResource<Store>('/admin/stores');
  const [editing, setEditing] = useState<Store | null | undefined>(undefined);

  const columns: Column<Store>[] = [
    {
      key: 'name',
      header: 'Название',
      render: (s) => (
        <span className="font-medium text-zinc-900">
          {s.name}
          {s.is_default && (
            <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">По умолчанию</span>
          )}
        </span>
      ),
    },
    { key: 'code', header: 'Код', render: (s) => s.code ?? '—' },
    { key: 'type', header: 'Тип', render: (s) => STORE_TYPES[s.type] ?? s.type },
    { key: 'address', header: 'Адрес', render: (s) => s.address ?? '—' },
    { key: 'active', header: 'Клиентам', render: (s) => (s.is_active ? 'Доступен' : 'Выключен') },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (s) => (
        <div className="flex justify-end gap-4">
          <button type="button" className={buttonLink} onClick={() => setEditing(s)}>Изменить</button>
          <ConfirmButton
            question="Удалить склад? Склад с историей удалить нельзя — его можно только выключить."
            onConfirm={() => stores.remove(s.id)}
          >
            Удалить
          </ConfirmButton>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Склады"
        actions={<button type="button" className={buttonPrimary} onClick={() => setEditing(null)}>Добавить склад</button>}
      />
      <p className="mb-4 text-sm text-zinc-500">
        Склад «по умолчанию» витрина выбирает первым. Выключенный склад не виден клиентам, но в нём можно проводить приёмки и списания.
      </p>
      <DataTable columns={columns} rows={stores.items} loading={stores.loading} emptyText="Складов нет" />

      {editing !== undefined && (
        <CrudModal
          title={editing ? 'Изменить склад' : 'Новый склад'}
          schema={schema}
          defaultValues={toForm(editing)}
          onSubmit={(values) => (editing ? stores.update(editing.id, values) : stores.create(values))}
          onClose={() => setEditing(undefined)}
        >
          {(form) => {
            const { errors } = form.formState;
            return (
              <>
                <Field label="Название *" htmlFor="store-name" error={errors.name?.message}>
                  <input id="store-name" className={inputClass} {...form.register('name')} />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Код" htmlFor="store-code" error={errors.code?.message}>
                    <input id="store-code" className={inputClass} {...form.register('code')} />
                  </Field>
                  <Field label="Тип" htmlFor="store-type" error={errors.type?.message}>
                    <select id="store-type" className={inputClass} {...form.register('type')}>
                      {Object.entries(STORE_TYPES).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field label="Адрес" htmlFor="store-address" error={errors.address?.message}>
                  <input id="store-address" className={inputClass} {...form.register('address')} />
                </Field>
                <label className="flex items-center gap-2 text-sm text-zinc-700">
                  <input type="checkbox" {...form.register('is_active')} />
                  Доступен клиентам
                </label>
                <label className="flex items-center gap-2 text-sm text-zinc-700">
                  <input type="checkbox" {...form.register('is_default')} />
                  Склад по умолчанию
                </label>
              </>
            );
          }}
        </CrudModal>
      )}
    </div>
  );
}
