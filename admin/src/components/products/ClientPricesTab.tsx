'use client';

import { useEffect, useState } from 'react';
import { z } from 'zod';
import { useResource } from '@/lib/crud';
import { formatTenge, TENGE_PATTERN, tiynToTenge } from '@/lib/money';
import { clientLabel, type ClientRef } from '@/lib/text';
import ConfirmButton from '@/components/ui/ConfirmButton';
import CrudModal from '@/components/ui/CrudModal';
import DataTable, { type Column } from '@/components/ui/DataTable';
import EntityPicker from '@/components/ui/EntityPicker';
import Field from '@/components/ui/Field';
import MoneyInput from '@/components/ui/MoneyInput';
import { buttonLink, buttonPrimary } from '@/components/ui/styles';

type ClientPrice = { id: number; user_id: number; price: number; user: ClientRef };

const schema = z.object({
  user_id: z.string().min(1, 'Выберите клиента'),
  price: z.string().regex(TENGE_PATTERN, 'Сумма в ₸, до двух знаков после точки'),
});

export default function ClientPricesTab({ productId, onCount }: { productId: number; onCount?: (count: number) => void }) {
  const prices = useResource<ClientPrice>(`/admin/products/${productId}/client-prices`);

  // Счётчик для заголовка блока — только когда список уже загружен.
  useEffect(() => {
    if (!prices.loading) {
      onCount?.(prices.items.length);
    }
  }, [prices.loading, prices.items.length, onCount]);
  const [editing, setEditing] = useState<ClientPrice | null | undefined>(undefined);
  const [picked, setPicked] = useState<ClientRef | null>(null);

  const close = () => {
    setEditing(undefined);
    setPicked(null);
  };

  const columns: Column<ClientPrice>[] = [
    { key: 'client', header: 'Клиент', render: (p) => clientLabel(p.user) },
    { key: 'price', header: 'Цена', render: (p) => formatTenge(p.price) },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (p) => (
        <div className="flex justify-end gap-4">
          <button type="button" className={buttonLink} onClick={() => setEditing(p)}>Изменить</button>
          <ConfirmButton onConfirm={() => prices.remove(p.id)}>Удалить</ConfirmButton>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <button type="button" className={buttonPrimary} onClick={() => setEditing(null)}>Добавить цену клиента</button>
      <DataTable columns={columns} rows={prices.items} loading={prices.loading} emptyText="Персональных цен нет" />

      {editing !== undefined && (
        <CrudModal
          title={editing ? 'Изменить цену клиента' : 'Новая цена клиента'}
          schema={schema}
          defaultValues={{ user_id: editing ? String(editing.user_id) : '', price: tiynToTenge(editing?.price) }}
          onSubmit={(values) => (editing ? prices.update(editing.id, values) : prices.create(values))}
          onClose={close}
        >
          {(form) => (
            <>
              <Field label="Клиент *" error={form.formState.errors.user_id?.message}>
                {editing ? (
                  <p className="text-sm text-zinc-900">{clientLabel(editing.user)}</p>
                ) : picked ? (
                  <p className="text-sm text-zinc-900">
                    {clientLabel(picked)}{' '}
                    <button
                      type="button"
                      className={buttonLink}
                      onClick={() => {
                        setPicked(null);
                        form.setValue('user_id', '');
                      }}
                    >
                      сменить
                    </button>
                  </p>
                ) : (
                  <EntityPicker<ClientRef>
                    searchPath="/admin/users"
                    sort="company_name"
                    placeholder="Найти B2B-клиента"
                    label={(c) => c.company_name || c.name || `Клиент #${c.id}`}
                    description={(c) => (
                      <>
                        {[c.company_name ? c.name : null, c.phone || c.email].filter(Boolean).join(' · ')}
                        {c.is_approved === false && <span className="ml-2 rounded bg-amber-100 px-1.5 text-amber-800">не одобрен</span>}
                      </>
                    )}
                    allExcludedText="Все клиенты уже с ценой"
                    excludeIds={prices.items.map((p) => p.user_id)}
                    onPick={(c) => {
                      setPicked(c);
                      form.setValue('user_id', String(c.id), { shouldValidate: true });
                    }}
                  />
                )}
              </Field>
              <Field label="Цена, ₸ *" htmlFor="client-price" error={form.formState.errors.price?.message}>
                <MoneyInput id="client-price" {...form.register('price')} />
              </Field>
            </>
          )}
        </CrudModal>
      )}
    </div>
  );
}
