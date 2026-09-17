'use client';

import type { UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { REQUIRED } from '@/lib/validation';
import type { GoodsReceipt, Supplier } from '@/lib/warehouse';
import Field from '@/components/ui/Field';
import { inputClass } from '@/components/ui/styles';
import StoreSelect from './StoreSelect';

export const receiptSchema = z.object({
  store_id: z.string().min(1, REQUIRED),
  supplier_id: z.string(),
  number: z.string().max(255),
  received_at: z.string(),
  note: z.string().max(2000),
});

export type ReceiptFormValues = z.infer<typeof receiptSchema>;

/** `<input type="datetime-local">` wants `YYYY-MM-DDTHH:mm` in local time. */
const toLocalInput = (value: string | null): string => {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const toReceiptForm = (r: GoodsReceipt | null): ReceiptFormValues => ({
  store_id: r ? String(r.store_id) : '',
  supplier_id: r?.supplier_id ? String(r.supplier_id) : '',
  number: r?.number ?? '',
  received_at: toLocalInput(r?.received_at ?? null),
  note: r?.note ?? '',
});

/**
 * `<input type="datetime-local">` yields an offset-less string
 * ("2026-09-17T14:30"). `new Date(...)` parses that as local time, but the
 * API stores `received_at` as a UTC instant (`APP_TIMEZONE=UTC`) — sent
 * verbatim, Laravel would read "14:30" as UTC, and every later render would
 * shift it by the browser's offset (an Almaty admin who types 14:30 would
 * see 19:30 after reload). Converting to an ISO string here fixes the
 * intended local instant as its UTC equivalent before it leaves the browser;
 * `toReceiptForm`/`toLocalInput` above do the inverse when displaying it.
 */
export const toReceiptPayload = (values: ReceiptFormValues): ReceiptFormValues => ({
  ...values,
  received_at: values.received_at ? new Date(values.received_at).toISOString() : '',
});

export function ReceiptFields({ form, suppliers }: { form: UseFormReturn<ReceiptFormValues>; suppliers: Supplier[] }) {
  const { errors } = form.formState;

  return (
    <>
      <Field label="Склад *" htmlFor="gr-store" error={errors.store_id?.message}>
        <StoreSelect id="gr-store" {...form.register('store_id')} />
      </Field>
      <Field label="Поставщик" htmlFor="gr-supplier" error={errors.supplier_id?.message}>
        <select id="gr-supplier" className={inputClass} {...form.register('supplier_id')}>
          <option value="">Без поставщика</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Номер" htmlFor="gr-number" error={errors.number?.message}>
          <input id="gr-number" className={inputClass} {...form.register('number')} />
        </Field>
        <Field label="Дата приёмки" htmlFor="gr-date" error={errors.received_at?.message}>
          <input id="gr-date" type="datetime-local" className={inputClass} {...form.register('received_at')} />
        </Field>
      </div>
      <Field label="Комментарий" htmlFor="gr-note" error={errors.note?.message}>
        <textarea id="gr-note" rows={2} className={inputClass} {...form.register('note')} />
      </Field>
    </>
  );
}
