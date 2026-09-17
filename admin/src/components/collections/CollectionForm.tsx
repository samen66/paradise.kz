'use client';

import type { UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { SLUG_PATTERN, translatable } from '@/lib/validation';
import Field from '@/components/ui/Field';
import TranslatableField from '@/components/ui/TranslatableField';
import { inputClass } from '@/components/ui/styles';

export type Collection = {
  id: number;
  title: { ru?: string; kk?: string };
  slug: string;
  sort_order: number;
  is_active: boolean;
  products_count?: number;
};

export const collectionSchema = z.object({
  title: translatable,
  slug: z.string().regex(SLUG_PATTERN, 'Латиница в нижнем регистре, цифры и дефисы'),
  sort_order: z.string().regex(/^-?\d*$/, 'Целое число'),
  is_active: z.boolean(),
});

export type CollectionFormValues = z.infer<typeof collectionSchema>;

export const toCollectionForm = (c: Collection | null): CollectionFormValues => ({
  title: { ru: c?.title?.ru ?? '', kk: c?.title?.kk ?? '' },
  slug: c?.slug ?? '',
  sort_order: c ? String(c.sort_order) : '0',
  is_active: c?.is_active ?? true,
});

export function CollectionFields({ form }: { form: UseFormReturn<CollectionFormValues> }) {
  const { errors } = form.formState;

  return (
    <>
      <TranslatableField form={form} name="title" label="Заголовок" required />
      <div className="grid grid-cols-2 gap-4">
        <Field label="Slug *" htmlFor="col-slug" error={errors.slug?.message}>
          <input id="col-slug" className={inputClass} {...form.register('slug')} />
        </Field>
        <Field label="Порядок" htmlFor="col-sort" error={errors.sort_order?.message}>
          <input id="col-sort" type="number" className={inputClass} {...form.register('sort_order')} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-zinc-700">
        <input type="checkbox" {...form.register('is_active')} />
        Показывать на витрине
      </label>
    </>
  );
}
