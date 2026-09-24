'use client';

import { Controller, type UseFormReturn } from 'react-hook-form';
import Switch from '@/components/ui/Switch';
import FormCard from './FormCard';
import type { ProductFormValues } from './formModel';

export default function StatusCard({ form, className }: { form: UseFormReturn<ProductFormValues>; className?: string }) {
  return (
    <FormCard id="status" title="Статус" className={className}>
      <div className="space-y-1">
        <Controller
          control={form.control}
          name="is_active"
          render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label="Показывать на витрине" />}
        />
        <Controller
          control={form.control}
          name="is_new_arrival"
          render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label="Новинка" />}
        />
      </div>
    </FormCard>
  );
}
