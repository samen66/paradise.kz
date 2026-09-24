'use client';

import { useWatch, type UseFormReturn } from 'react-hook-form';
import Field from '@/components/ui/Field';
import LocaleSwitch, { LOCALES, type Locale } from '@/components/ui/LocaleSwitch';
import { inputClass } from '@/components/ui/styles';
import FormCard from './FormCard';
import type { ProductFormValues } from './formModel';

type Props = {
  form: UseFormReturn<ProductFormValues>;
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  className?: string;
};

export default function BasicSection({ form, locale, onLocaleChange, className }: Props) {
  const {
    register,
    control,
    formState: { errors },
  } = form;
  const name = useWatch({ control, name: 'name' });
  const missingKk = name.ru.trim() !== '' && name.kk.trim() === '';

  return (
    <FormCard
      id="basic"
      title="Основное"
      className={className}
      aside={
        <LocaleSwitch
          value={locale}
          onChange={onLocaleChange}
          missing={{ kk: missingKk }}
          invalid={{
            ru: Boolean(errors.name?.ru || errors.description?.ru),
            kk: Boolean(errors.name?.kk || errors.description?.kk),
          }}
        />
      }
    >
      {LOCALES.map((l) => (
        <div key={l} hidden={locale !== l} className="space-y-4">
          <Field label={l === 'ru' ? 'Название *' : 'Название на казахском'} htmlFor={`name-${l}`} error={errors.name?.[l]?.message}>
            <input id={`name-${l}`} className={inputClass} aria-invalid={errors.name?.[l] ? true : undefined} {...register(`name.${l}`)} />
          </Field>
          <Field label={l === 'ru' ? 'Описание' : 'Описание на казахском'} htmlFor={`description-${l}`} error={errors.description?.[l]?.message}>
            <textarea
              id={`description-${l}`}
              rows={5}
              className={`${inputClass} resize-y`}
              aria-invalid={errors.description?.[l] ? true : undefined}
              {...register(`description.${l}`)}
            />
          </Field>
        </div>
      ))}
      {missingKk && (
        <p className="text-xs text-zinc-500">
          <span className="text-amber-500">●</span> — казахский перевод не заполнен
        </p>
      )}
    </FormCard>
  );
}
