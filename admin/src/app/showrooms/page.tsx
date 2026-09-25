'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { z } from 'zod';
import CrudModal from '@/components/ui/CrudModal';
import DataTable, { type Column } from '@/components/ui/DataTable';
import EmptyState from '@/components/ui/EmptyState';
import Field from '@/components/ui/Field';
import PageHeader from '@/components/ui/PageHeader';
import { buttonLink, buttonPrimary, inputClass } from '@/components/ui/styles';
import { useResource } from '@/lib/crud';
import { STATUS_CHIP, showroomStatus, type Showroom } from '@/lib/showrooms';
import { REQUIRED, SLUG_PATTERN } from '@/lib/validation';

const createSchema = z.object({
  name: z.string().min(1, REQUIRED).max(255),
  address: z.string().max(255),
  slug: z.string().max(100).refine((v) => v === '' || SLUG_PATTERN.test(v), 'Только строчная латиница, цифры и дефис'),
});

/** Шоурумы — места хранения с типом «Точка выдачи / шоурум». */
export default function ShowroomsPage() {
  const router = useRouter();
  const showrooms = useResource<Showroom>('/admin/showrooms');
  const [creating, setCreating] = useState(false);

  const addButton = (
    <button type="button" className={buttonPrimary} onClick={() => setCreating(true)}>
      Добавить шоурум
    </button>
  );

  const columns: Column<Showroom>[] = [
    {
      key: 'cover',
      header: '',
      mobile: 'hidden',
      className: 'w-16',
      render: (s) =>
        s.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.cover_url} alt="" className="h-12 w-12 rounded-lg object-cover" />
        ) : (
          <div className="h-12 w-12 rounded-lg bg-zinc-100" />
        ),
    },
    {
      key: 'name',
      header: 'Шоурум',
      mobile: 'title',
      render: (s) => (
        <Link href={`/showrooms/${s.id}`} className="font-medium text-zinc-900 hover:text-blue-700">
          {s.name}
        </Link>
      ),
    },
    { key: 'place', header: 'Адрес', mobile: 'meta', render: (s) => [s.city, s.address].filter(Boolean).join(' · ') || '—' },
    {
      key: 'status',
      header: 'Статус',
      mobile: 'badge',
      render: (s) => {
        const chip = STATUS_CHIP[showroomStatus(s)];
        return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${chip.className}`}>{chip.label}</span>;
      },
    },
    {
      key: 'actions',
      header: '',
      mobile: 'actions',
      className: 'text-right',
      render: (s) => (
        <Link href={`/showrooms/${s.id}`} className={buttonLink}>
          Открыть
        </Link>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Шоурумы" actions={addButton} />
      <p className="mb-4 text-sm text-zinc-500">
        Шоурум — место хранения с типом «Точка выдачи / шоурум»: на сайте видны его адрес, часы и товары из его остатков.
        Включить или выключить склад можно в разделе «Склад → Места хранения».
      </p>
      <DataTable
        columns={columns}
        rows={showrooms.items}
        loading={showrooms.loading}
        empty={
          <EmptyState
            title="Шоурумов нет"
            hint="Шоурум — это место хранения с типом «Точка выдачи / шоурум» — его остатки показываются на сайте."
            action={addButton}
          />
        }
      />

      {creating && (
        <CrudModal
          title="Новый шоурум"
          schema={createSchema}
          defaultValues={{ name: '', address: '', slug: '' }}
          onSubmit={async (values) => {
            const created = await showrooms.create(values);
            router.push(`/showrooms/${created.id}`);
          }}
          onClose={() => setCreating(false)}
        >
          {(form) => {
            const { errors } = form.formState;
            return (
              <>
                <Field label="Название *" htmlFor="showroom-name" error={errors.name?.message}>
                  <input id="showroom-name" className={inputClass} {...form.register('name')} />
                </Field>
                <Field label="Адрес" htmlFor="showroom-address" error={errors.address?.message}>
                  <input id="showroom-address" className={inputClass} {...form.register('address')} />
                </Field>
                <Field
                  label="Адрес страницы (slug)"
                  htmlFor="showroom-slug"
                  error={errors.slug?.message}
                  hint="Можно оставить пустым — составим из названия"
                >
                  <input id="showroom-slug" className={inputClass} {...form.register('slug')} />
                </Field>
              </>
            );
          }}
        </CrudModal>
      )}
    </div>
  );
}
