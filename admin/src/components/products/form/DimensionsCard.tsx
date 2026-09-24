'use client';

import type { UseFormReturn } from 'react-hook-form';
import Field from '@/components/ui/Field';
import { inputClass } from '@/components/ui/styles';
import FormCard from './FormCard';
import type { ProductFormValues } from './formModel';

export default function DimensionsCard({ form, className }: { form: UseFormReturn<ProductFormValues>; className?: string }) {
  const { register, formState: { errors } } = form;
  // Текст, а не type="number": непонятное браузеру «54,5» в number-поле
  // читается как пусто и молча сохранилось бы как null. Здесь его разберёт схема.
  const decimal = { type: 'text', inputMode: 'decimal' } as const;

  return (
    <FormCard id="dimensions" title="Габариты и происхождение" className={className}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Вес, кг" htmlFor="weight" error={errors.weight?.message}>
          <input id="weight" {...decimal} className={inputClass} aria-invalid={errors.weight ? true : undefined} {...register('weight')} />
        </Field>
        <Field label="Объём, м³" htmlFor="volume" error={errors.volume?.message}>
          <input id="volume" {...decimal} className={inputClass} aria-invalid={errors.volume ? true : undefined} {...register('volume')} />
        </Field>
      </div>
      <Field label="Страна" htmlFor="country" error={errors.country?.message}>
        <input id="country" className={inputClass} placeholder="Казахстан" aria-invalid={errors.country ? true : undefined} {...register('country')} />
      </Field>
      <Field label="Поставщик" htmlFor="supplier" error={errors.supplier?.message}>
        <input id="supplier" className={inputClass} placeholder="ТОО Поставщик" aria-invalid={errors.supplier ? true : undefined} {...register('supplier')} />
      </Field>
    </FormCard>
  );
}
