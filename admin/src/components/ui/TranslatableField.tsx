'use client';

import { get, type FieldValues, type Path, type UseFormReturn } from 'react-hook-form';
import Field from './Field';
import { inputClass } from './styles';

type Props<T extends FieldValues> = {
  form: UseFormReturn<T>;
  name: string;
  label: string;
  required?: boolean;
  multiline?: boolean;
};

const LOCALES = ['ru', 'kk'] as const;

export default function TranslatableField<T extends FieldValues>({ form, name, label, required, multiline }: Props<T>) {
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {LOCALES.map((locale) => {
        const path = `${name}.${locale}` as Path<T>;
        const id = `${name}-${locale}`;
        const error = get(errors, path)?.message as string | undefined;
        const star = required && locale === 'ru' ? ' *' : '';

        return (
          <Field key={locale} label={`${label} (${locale.toUpperCase()})${star}`} htmlFor={id} error={error}>
            {multiline ? (
              <textarea id={id} rows={3} className={`${inputClass} resize-y`} {...register(path)} />
            ) : (
              <input id={id} className={inputClass} {...register(path)} />
            )}
          </Field>
        );
      })}
    </div>
  );
}
