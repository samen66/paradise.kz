'use client';

import { useMemo } from 'react';
import { Controller } from 'react-hook-form';
import { z } from 'zod';
import { categoryOptions, type NamedOption } from '@/components/products/form/formModel';
import CrudModal from '@/components/ui/CrudModal';
import Field from '@/components/ui/Field';
import SearchSelect from '@/components/ui/SearchSelect';
import TranslatableField from '@/components/ui/TranslatableField';
import api from '@/lib/api';
import { REQUIRED } from '@/lib/validation';

const LONG = 'Не длиннее 255 символов';

const schema = z.object({
  name: z.object({ ru: z.string().trim().min(1, REQUIRED).max(255, LONG), kk: z.string().max(255, LONG) }),
  parent_id: z.string(),
});

type Props = {
  initialName: string;
  categories: NamedOption[];
  onSaved: (category: NamedOption) => void;
  onClose: () => void;
};

/**
 * Новая категория из карточки товара. Родитель выбирается без «+ Создать» —
 * шторка в шторке была бы уже лишней.
 */
export default function CategoryFormSheet({ initialName, categories, onSaved, onClose }: Props) {
  const parents = useMemo(() => categoryOptions(categories), [categories]);

  return (
    <CrudModal
      title="Новая категория"
      schema={schema}
      defaultValues={{ name: { ru: initialName, kk: '' }, parent_id: '' }}
      submitLabel="Создать"
      onSubmit={async (values) => {
        const res = await api.post('/admin/categories', {
          name: values.name,
          parent_id: values.parent_id === '' ? null : Number(values.parent_id),
          is_active: true,
        });
        onSaved((res.data?.data ?? res.data) as NamedOption);
      }}
      onClose={onClose}
    >
      {(form) => (
        <>
          <TranslatableField form={form} name="name" label="Название" required />
          <Field label="Родительская категория" htmlFor="category-parent" error={form.formState.errors.parent_id?.message}>
            <Controller
              control={form.control}
              name="parent_id"
              render={({ field }) => (
                <SearchSelect id="category-parent" options={parents} value={field.value} onChange={field.onChange} emptyLabel="Верхний уровень" />
              )}
            />
          </Field>
        </>
      )}
    </CrudModal>
  );
}
