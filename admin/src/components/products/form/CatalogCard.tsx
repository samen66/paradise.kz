'use client';

import { useMemo, useState } from 'react';
import { Controller, type UseFormReturn } from 'react-hook-form';
import BrandFormSheet from '@/components/catalog/BrandFormSheet';
import CategoryFormSheet from '@/components/catalog/CategoryFormSheet';
import Field from '@/components/ui/Field';
import SearchSelect from '@/components/ui/SearchSelect';
import FormCard from './FormCard';
import { brandOptions, categoryOptions, type NamedOption, type ProductFormValues } from './formModel';

type Props = {
  form: UseFormReturn<ProductFormValues>;
  categories: NamedOption[];
  brands: NamedOption[];
  onCategoryCreated: (category: NamedOption) => void;
  onBrandCreated: (brand: NamedOption) => void;
  className?: string;
};

export default function CatalogCard({ form, categories, brands, onCategoryCreated, onBrandCreated, className }: Props) {
  const { control, formState: { errors } } = form;
  const categoryList = useMemo(() => categoryOptions(categories), [categories]);
  const brandList = useMemo(() => brandOptions(brands), [brands]);
  const [creating, setCreating] = useState<{ kind: 'category' | 'brand'; name: string } | null>(null);

  return (
    <FormCard id="catalog" title="Каталог" className={className}>
      <Field label="Категория" htmlFor="category_id" error={errors.category_id?.message}>
        <Controller
          control={control}
          name="category_id"
          render={({ field }) => (
            <SearchSelect
              id="category_id"
              options={categoryList}
              value={field.value}
              onChange={field.onChange}
              emptyLabel="Без категории"
              invalid={Boolean(errors.category_id)}
              onCreate={(name) => setCreating({ kind: 'category', name })}
            />
          )}
        />
      </Field>
      <Field label="Бренд" htmlFor="brand_id" error={errors.brand_id?.message}>
        <Controller
          control={control}
          name="brand_id"
          render={({ field }) => (
            <SearchSelect
              id="brand_id"
              options={brandList}
              value={field.value}
              onChange={field.onChange}
              emptyLabel="Без бренда"
              invalid={Boolean(errors.brand_id)}
              onCreate={(name) => setCreating({ kind: 'brand', name })}
            />
          )}
        />
      </Field>

      {creating?.kind === 'category' && (
        <CategoryFormSheet
          initialName={creating.name}
          categories={categories}
          onSaved={(category) => {
            onCategoryCreated(category);
            form.setValue('category_id', String(category.id), { shouldDirty: true, shouldValidate: true });
          }}
          onClose={() => setCreating(null)}
        />
      )}
      {creating?.kind === 'brand' && (
        <BrandFormSheet
          initialName={creating.name}
          onSaved={(brand) => {
            onBrandCreated(brand);
            form.setValue('brand_id', String(brand.id), { shouldDirty: true, shouldValidate: true });
          }}
          onClose={() => setCreating(null)}
        />
      )}
    </FormCard>
  );
}
