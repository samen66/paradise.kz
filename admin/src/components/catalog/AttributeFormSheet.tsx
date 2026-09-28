'use client';

import { z } from 'zod';
import CrudModal from '@/components/ui/CrudModal';
import Field from '@/components/ui/Field';
import TranslatableField from '@/components/ui/TranslatableField';
import { inputClass } from '@/components/ui/styles';
import api from '@/lib/api';
import type { Attribute } from '@/lib/catalogTypes';
import { kk, ru } from '@/lib/text';
import { REQUIRED, SLUG_PATTERN } from '@/lib/validation';

const LONG = 'Не длиннее 255 символов';

const schema = z.object({
  name: z.object({ ru: z.string().trim().min(1, REQUIRED).max(255, LONG), kk: z.string().max(255, LONG) }),
  slug: z.string().refine((v) => v === '' || SLUG_PATTERN.test(v), 'Латиница в нижнем регистре, цифры и дефисы'),
  is_filterable: z.boolean(),
});

type Props = {
  /** null — новый атрибут. */
  attribute: Attribute | null;
  /** Текст из поиска «+ Создать „…“». */
  initialName?: string;
  onSaved: (attribute: Attribute) => void;
  onClose: () => void;
};

/**
 * Атрибут: создание (из карточки товара или с экрана «Атрибуты») и правка.
 * Slug спрятан под «Дополнительно»: пустой при создании — сервер сделает его
 * из русского названия.
 */
export default function AttributeFormSheet({ attribute, initialName = '', onSaved, onClose }: Props) {
  return (
    <CrudModal
      title={attribute ? 'Изменить атрибут' : 'Новый атрибут'}
      schema={schema}
      defaultValues={{
        name: { ru: attribute ? ru(attribute.name) : initialName, kk: attribute ? kk(attribute.name) : '' },
        slug: attribute?.slug ?? '',
        is_filterable: attribute?.is_filterable ?? false,
      }}
      submitLabel={attribute ? 'Сохранить' : 'Создать'}
      onSubmit={async (values) => {
        const payload = { name: values.name, is_filterable: values.is_filterable, ...(values.slug ? { slug: values.slug } : {}) };
        const res = attribute ? await api.put(`/admin/attributes/${attribute.id}`, payload) : await api.post('/admin/attributes', payload);
        onSaved(res.data.data as Attribute);
      }}
      onClose={onClose}
    >
      {(form) => (
        <>
          <TranslatableField form={form} name="name" label="Название" required />
          <label className="flex min-h-11 items-center gap-2 text-sm text-zinc-700 md:min-h-0">
            <input type="checkbox" {...form.register('is_filterable')} />
            Показывать в фильтрах витрины
          </label>
          <details className="rounded-xl border border-zinc-200 px-3" open={Boolean(form.formState.errors.slug)}>
            <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-zinc-700 md:min-h-9">Дополнительно</summary>
            <div className="pb-3">
              <Field
                label="Slug"
                htmlFor="attribute-slug"
                hint={attribute ? 'Изменит ссылки фильтров на витрине' : 'Пусто — сделаем из названия'}
                error={form.formState.errors.slug?.message}
              >
                <input id="attribute-slug" className={inputClass} {...form.register('slug')} />
              </Field>
            </div>
          </details>
        </>
      )}
    </CrudModal>
  );
}
