'use client';

import { useMemo } from 'react';
import { Controller, type UseFormReturn } from 'react-hook-form';
import Field from '@/components/ui/Field';
import SearchSelect from '@/components/ui/SearchSelect';
import FormCard from './FormCard';
import { brandOptions, categoryOptions, type NamedOption, type ProductFormValues } from './formModel';

type Props = { form: UseFormReturn<ProductFormValues>; categories: NamedOption[]; brands: NamedOption[]; className?: string };

export default function CatalogCard({ form, categories, brands, className }: Props) {
  const { control, formState: { errors } } = form;
  const categoryList = useMemo(() => categoryOptions(categories), [categories]);
  const brandList = useMemo(() => brandOptions(brands), [brands]);

  return (
    <FormCard id="catalog" title="Каталог" className={className}>
      <Field label="Категория" htmlFor="category_id" error={errors.category_id?.message}>
        <Controller
          control={control}
          name="category_id"
          render={({ field }) => (
            <SearchSelect id="category_id" options={categoryList} value={field.value} onChange={field.onChange} emptyLabel="Без категории" invalid={Boolean(errors.category_id)} />
          )}
        />
      </Field>
      <Field label="Бренд" htmlFor="brand_id" error={errors.brand_id?.message}>
        <Controller
          control={control}
          name="brand_id"
          render={({ field }) => (
            <SearchSelect id="brand_id" options={brandList} value={field.value} onChange={field.onChange} emptyLabel="Без бренда" invalid={Boolean(errors.brand_id)} />
          )}
        />
      </Field>
    </FormCard>
  );
}
