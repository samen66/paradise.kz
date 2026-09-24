'use client';

import type { UseFormReturn } from 'react-hook-form';
import Field from '@/components/ui/Field';
import { inputClass } from '@/components/ui/styles';
import FormCard from './FormCard';
import type { ProductFormValues } from './formModel';

export default function AccountingCard({ form, className }: { form: UseFormReturn<ProductFormValues>; className?: string }) {
  const { register, formState: { errors } } = form;

  return (
    <FormCard id="accounting" title="Учёт" className={className}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Код" htmlFor="code" error={errors.code?.message}>
          <input id="code" className={inputClass} placeholder="00123" aria-invalid={errors.code ? true : undefined} {...register('code')} />
        </Field>
        <Field label="Артикул" htmlFor="article" error={errors.article?.message}>
          <input id="article" className={inputClass} placeholder="ART-0042" aria-invalid={errors.article ? true : undefined} {...register('article')} />
        </Field>
      </div>
      <Field label="Единица измерения" htmlFor="uom" error={errors.uom?.message}>
        <input id="uom" className={inputClass} placeholder="шт" aria-invalid={errors.uom ? true : undefined} {...register('uom')} />
      </Field>
    </FormCard>
  );
}
