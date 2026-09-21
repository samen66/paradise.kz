'use client';

import { useState } from 'react';
import { z } from 'zod';
import { useResource } from '@/lib/crud';
import { REQUIRED } from '@/lib/validation';
import type { Supplier } from '@/lib/warehouse';
import ConfirmButton from '@/components/ui/ConfirmButton';
import CrudModal from '@/components/ui/CrudModal';
import DataTable, { type Column } from '@/components/ui/DataTable';
import Field from '@/components/ui/Field';
import PageHeader from '@/components/ui/PageHeader';
import { buttonLink, buttonPrimary, inputClass } from '@/components/ui/styles';

const schema = z.object({
  name: z.string().min(1, REQUIRED).max(255),
  bin: z.string().max(32),
  phone: z.string().max(64),
  email: z.union([z.literal(''), z.string().email('Некорректный email')]),
  note: z.string().max(2000),
  is_active: z.boolean(),
});

type SupplierForm = z.infer<typeof schema>;

const toForm = (s: Supplier | null): SupplierForm => ({
  name: s?.name ?? '',
  bin: s?.bin ?? '',
  phone: s?.phone ?? '',
  email: s?.email ?? '',
  note: s?.note ?? '',
  is_active: s?.is_active ?? true,
});

export default function SuppliersPage() {
  const [search, setSearch] = useState('');
  const suppliers = useResource<Supplier>('/admin/suppliers', search.trim() ? { 'filter[search]': search.trim() } : undefined);
  const [editing, setEditing] = useState<Supplier | null | undefined>(undefined);

  const columns: Column<Supplier>[] = [
    { key: 'name', header: 'Название', render: (s) => <span className="font-medium text-zinc-900">{s.name}</span> },
    { key: 'bin', header: 'БИН/ИИН', render: (s) => s.bin ?? '—' },
    { key: 'phone', header: 'Телефон', render: (s) => s.phone ?? '—' },
    { key: 'active', header: 'Статус', render: (s) => (s.is_active ? 'Активен' : 'Выключен') },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (s) => (
        <div className="flex justify-end gap-4">
          <button type="button" className={buttonLink} onClick={() => setEditing(s)}>Изменить</button>
          <ConfirmButton onConfirm={() => suppliers.remove(s.id)}>Удалить</ConfirmButton>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Поставщики"
        actions={<button type="button" className={buttonPrimary} onClick={() => setEditing(null)}>Добавить поставщика</button>}
      />
      <input
        className={`${inputClass} mb-4 max-w-md`}
        placeholder="Поиск по названию или БИН"
        aria-label="Поиск по названию или БИН"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <DataTable columns={columns} rows={suppliers.items} loading={suppliers.loading} emptyText="Поставщиков нет" />

      {editing !== undefined && (
        <CrudModal
          title={editing ? 'Изменить поставщика' : 'Новый поставщик'}
          schema={schema}
          defaultValues={toForm(editing)}
          onSubmit={(values) => (editing ? suppliers.update(editing.id, values) : suppliers.create(values))}
          onClose={() => setEditing(undefined)}
        >
          {(form) => {
            const { errors } = form.formState;
            return (
              <>
                <Field label="Название *" htmlFor="sup-name" error={errors.name?.message}>
                  <input id="sup-name" className={inputClass} {...form.register('name')} />
                </Field>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="БИН/ИИН" htmlFor="sup-bin" error={errors.bin?.message}>
                    <input id="sup-bin" className={inputClass} {...form.register('bin')} />
                  </Field>
                  <Field label="Телефон" htmlFor="sup-phone" error={errors.phone?.message}>
                    <input id="sup-phone" className={inputClass} {...form.register('phone')} />
                  </Field>
                </div>
                <Field label="Email" htmlFor="sup-email" error={errors.email?.message}>
                  <input id="sup-email" type="email" className={inputClass} {...form.register('email')} />
                </Field>
                <Field label="Заметка" htmlFor="sup-note" error={errors.note?.message}>
                  <textarea id="sup-note" rows={3} className={inputClass} {...form.register('note')} />
                </Field>
                <label className="flex items-center gap-2 text-sm text-zinc-700">
                  <input type="checkbox" {...form.register('is_active')} />
                  Активен
                </label>
              </>
            );
          }}
        </CrudModal>
      )}
    </div>
  );
}
