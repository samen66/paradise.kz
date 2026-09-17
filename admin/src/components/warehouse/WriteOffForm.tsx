'use client';

import type { UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { REQUIRED } from '@/lib/validation';
import { WRITE_OFF_REASONS, type WriteOff } from '@/lib/warehouse';
import Field from '@/components/ui/Field';
import { inputClass } from '@/components/ui/styles';
import StoreSelect from './StoreSelect';

export const writeOffSchema = z.object({
  store_id: z.string().min(1, REQUIRED),
  reason: z.string().min(1, REQUIRED),
  note: z.string().max(2000),
});

export type WriteOffFormValues = z.infer<typeof writeOffSchema>;

export const toWriteOffForm = (w: WriteOff | null): WriteOffFormValues => ({
  store_id: w ? String(w.store_id) : '',
  reason: w?.reason ?? 'damaged',
  note: w?.note ?? '',
});

export function WriteOffFields({ form }: { form: UseFormReturn<WriteOffFormValues> }) {
  const { errors } = form.formState;

  return (
    <>
      <Field label="Склад *" htmlFor="wo-store" error={errors.store_id?.message}>
        <StoreSelect id="wo-store" {...form.register('store_id')} />
      </Field>
      <Field label="Причина *" htmlFor="wo-reason" error={errors.reason?.message}>
        <select id="wo-reason" className={inputClass} {...form.register('reason')}>
          {Object.entries(WRITE_OFF_REASONS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </Field>
      <Field label="Комментарий" htmlFor="wo-note" error={errors.note?.message}>
        <textarea id="wo-note" rows={2} className={inputClass} {...form.register('note')} />
      </Field>
    </>
  );
}
