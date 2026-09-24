'use client';

import { useMemo } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import Field from '@/components/ui/Field';
import { inputClass } from '@/components/ui/styles';
import FormCard from './FormCard';
import { brandOptions, categoryOptions, type NamedOption, type ProductFormValues } from './formModel';

type Props = { form: UseFormReturn<ProductFormValues>; categories: NamedOption[]; brands: NamedOption[]; className?: string };

export default function CatalogCard({ form, categories, brands, className }: Props) {
  const { register, formState: { errors } } = form;
  const categoryList = useMemo(() => categoryOptions(categories), [categories]);
  const brandList = useMemo(() => brandOptions(brands), [brands]);

  return (
    <FormCard id="catalog" title="Каталог" className={className}>
      <Field label="Категория" htmlFor="category_id" error={errors.category_id?.message}>
        <select id="category_id" className={inputClass} aria-invalid={errors.category_id ? true : undefined} {...register('category_id')}>
          <option value="">Без категории</option>
          {categoryList.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </Field>
      <Field label="Бренд" htmlFor="brand_id" error={errors.brand_id?.message}>
        <select id="brand_id" className={inputClass} aria-invalid={errors.brand_id ? true : undefined} {...register('brand_id')}>
          <option value="">Без бренда</option>
          {brandList.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </Field>
    </FormCard>
  );
}
