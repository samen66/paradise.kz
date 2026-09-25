'use client';

import { useEffect, useState } from 'react';
import { z } from 'zod';
import type { Attribute } from '@/lib/catalogTypes';
import { useResource } from '@/lib/crud';
import { ru } from '@/lib/text';
import { REQUIRED } from '@/lib/validation';
import ConfirmButton from '@/components/ui/ConfirmButton';
import CrudModal from '@/components/ui/CrudModal';
import DataTable, { type Column } from '@/components/ui/DataTable';
import Field from '@/components/ui/Field';
import { buttonLink, buttonPrimary, inputClass } from '@/components/ui/styles';

type AttributeValue = { id: number; attribute_id: number; value: string; attribute: Pick<Attribute, 'id' | 'name' | 'slug'> };

const schema = z.object({
  attribute_id: z.string().min(1, REQUIRED),
  value: z.string().min(1, REQUIRED).max(255),
});

export default function AttributeValuesTab({ productId, onCount }: { productId: number; onCount?: (count: number) => void }) {
  const values = useResource<AttributeValue>(`/admin/products/${productId}/attribute-values`);

  // Счётчик для заголовка блока — только когда список уже загружен.
  useEffect(() => {
    if (!values.loading) {
      onCount?.(values.items.length);
    }
  }, [values.loading, values.items.length, onCount]);
  const attributes = useResource<Attribute>('/admin/attributes');
  const [editing, setEditing] = useState<AttributeValue | null | undefined>(undefined);

  const columns: Column<AttributeValue>[] = [
    { key: 'attribute', header: 'Атрибут', render: (v) => ru(v.attribute?.name) || `#${v.attribute_id}` },
    { key: 'value', header: 'Значение', render: (v) => v.value },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (v) => (
        <div className="flex justify-end gap-4">
          <button type="button" className={buttonLink} onClick={() => setEditing(v)}>Изменить</button>
          <ConfirmButton onConfirm={() => values.remove(v.id)}>Удалить</ConfirmButton>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <button type="button" className={buttonPrimary} onClick={() => setEditing(null)}>Добавить характеристику</button>
      <DataTable columns={columns} rows={values.items} loading={values.loading} emptyText="Характеристик нет" />

      {editing !== undefined && (
        <CrudModal
          title={editing ? 'Изменить характеристику' : 'Новая характеристика'}
          schema={schema}
          defaultValues={{ attribute_id: editing ? String(editing.attribute_id) : '', value: editing?.value ?? '' }}
          onSubmit={(v) => (editing ? values.update(editing.id, v) : values.create(v))}
          onClose={() => setEditing(undefined)}
        >
          {(form) => (
            <>
              <Field label="Атрибут *" htmlFor="av-attribute" error={form.formState.errors.attribute_id?.message}>
                <select id="av-attribute" className={inputClass} {...form.register('attribute_id')}>
                  <option value="">Выберите атрибут</option>
                  {attributes.items.map((a) => (
                    <option key={a.id} value={a.id}>{ru(a.name)}</option>
                  ))}
                </select>
              </Field>
              <Field label="Значение *" htmlFor="av-value" error={form.formState.errors.value?.message}>
                <input id="av-value" className={inputClass} {...form.register('value')} />
              </Field>
            </>
          )}
        </CrudModal>
      )}
    </div>
  );
}
