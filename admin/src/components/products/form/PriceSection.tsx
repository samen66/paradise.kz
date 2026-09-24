'use client';

import { useWatch, type UseFormReturn } from 'react-hook-form';
import Collapsible from '@/components/ui/Collapsible';
import Field from '@/components/ui/Field';
import MoneyInput from '@/components/ui/MoneyInput';
import { inputClass } from '@/components/ui/styles';
import FormCard from './FormCard';
import { markup, type MoneyField, type ProductFormValues } from './formModel';

type Props = {
  form: UseFormReturn<ProductFormValues>;
  extrasOpen: boolean;
  onExtrasToggle: (open: boolean) => void;
  className?: string;
};

export default function PriceSection({ form, extrasOpen, onExtrasToggle, className }: Props) {
  const {
    register,
    control,
    formState: { errors },
  } = form;
  const [retail, b2b, purchase] = useWatch({ control, name: ['retail_price', 'b2b_price', 'purchase_price'] });
  const markups: [string, number][] = [];
  for (const [label, value] of [
    ['розница', markup(retail, purchase)],
    ['опт', markup(b2b, purchase)],
  ] as const) {
    if (value !== null) {
      markups.push([label, value]);
    }
  }

  const money = (name: MoneyField, label: string, hint?: string) => (
    <Field label={label} htmlFor={name} hint={hint} error={errors[name]?.message}>
      <MoneyInput id={name} aria-invalid={errors[name] ? true : undefined} {...register(name)} />
    </Field>
  );

  return (
    <FormCard id="price" title="Цены, ₸" className={className}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {money('retail_price', 'Розничная')}
        {money('b2b_price', 'Оптовая (B2B)')}
        {money('compare_at_price', 'Старая цена', 'Зачёркнутая на витрине, если выше розничной')}
      </div>

      {markups.length > 0 && (
        <p className="text-sm text-zinc-600" data-testid="markup">
          Наценка к закупочной:{' '}
          {markups.map(([label, value], index) => (
            <span key={label}>
              {index > 0 && ', '}
              {label}{' '}
              <span className={value < 0 ? 'text-red-600' : 'text-green-700'}>
                {value > 0 ? '+' : ''}
                {value} %
              </span>
            </span>
          ))}
        </p>
      )}

      <Collapsible id="price-extra" plain title="Закупочная, минимальная цена, мин. партия B2B" open={extrasOpen} onToggle={onExtrasToggle}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {money('purchase_price', 'Закупочная цена')}
          {money('min_price', 'Минимальная цена', 'Ниже неё не опустит цену персональная скидка клиента')}
          <Field
            label="Мин. партия B2B, шт"
            htmlFor="b2b_min_order_qty"
            hint="Пусто — общее значение из настроек каталога"
            error={errors.b2b_min_order_qty?.message}
          >
            <input
              id="b2b_min_order_qty"
              type="number"
              step="1"
              min="1"
              inputMode="numeric"
              className={inputClass}
              aria-invalid={errors.b2b_min_order_qty ? true : undefined}
              {...register('b2b_min_order_qty')}
            />
          </Field>
        </div>
      </Collapsible>
    </FormCard>
  );
}
