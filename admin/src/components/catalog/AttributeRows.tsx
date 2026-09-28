'use client';

import { useMemo, useState } from 'react';
import { Controller, useFieldArray, useWatch, type UseFormReturn } from 'react-hook-form';
import type { Locale } from '@/components/ui/LocaleSwitch';
import SearchSelect from '@/components/ui/SearchSelect';
import { buttonSecondary, inputClass } from '@/components/ui/styles';
import type { Attribute } from '@/lib/catalogTypes';
import { ru } from '@/lib/text';
import AttributeFormSheet from './AttributeFormSheet';
import { emptyAttributeRow, type AttributeRowValue } from './attributeRows';

type WithAttributeRows = { attribute_values: AttributeRowValue[] };

type Props<T extends WithAttributeRows> = {
  form: UseFormReturn<T>;
  attributes: Attribute[];
  onAttributeCreated: (attribute: Attribute) => void;
  /** Язык видимого поля значения; второй язык остаётся в форме. */
  locale: Locale;
};

/**
 * Строки «атрибут → значение» — у товара и у варианта. Атрибут выбирается
 * из справочника или создаётся тут же («+ Создать»); атрибуты, занятые
 * другими строками, в списке не предлагаются.
 */
export default function AttributeRows<T extends WithAttributeRows>({ form: typedForm, attributes, onAttributeCreated, locale }: Props<T>) {
  // Компонент одинаково работает с формой товара и варианта; пути RHF
  // типизируются на их общем срезе.
  const form = typedForm as unknown as UseFormReturn<WithAttributeRows>;
  const { control, register, setValue, formState: { errors } } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'attribute_values' });
  const rows = useWatch({ control, name: 'attribute_values' }) ?? [];
  const [creating, setCreating] = useState<{ index: number; name: string } | null>(null);
  const [addedIndex, setAddedIndex] = useState<number | null>(null);

  const options = useMemo(
    () => attributes.map((a) => ({ value: String(a.id), label: ru(a.name) || a.slug })).sort((a, b) => a.label.localeCompare(b.label, 'ru')),
    [attributes],
  );

  return (
    <div className="space-y-3">
      {fields.length === 0 && <p className="text-sm text-zinc-500">Характеристик пока нет.</p>}
      <ul className="space-y-3">
        {fields.map((field, index) => {
          const rowErrors = errors.attribute_values?.[index];
          const taken = new Set(rows.filter((_, i) => i !== index).map((r) => r.attribute_id));
          const selectId = `attribute-${field.id}`;
          const valueId = `attribute-value-${field.id}`;
          const message = rowErrors?.attribute_id?.message ?? rowErrors?.value?.ru?.message ?? rowErrors?.value?.kk?.message;

          return (
            <li key={field.id} className="grid grid-cols-[1fr_auto] gap-2 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto] md:items-start">
              <div className="col-span-2 md:col-span-1">
                <label htmlFor={selectId} className="sr-only">Атрибут</label>
                <Controller
                  control={control}
                  name={`attribute_values.${index}.attribute_id`}
                  render={({ field: select }) => (
                    <SearchSelect
                      id={selectId}
                      options={options.filter((o) => !taken.has(o.value))}
                      value={select.value}
                      onChange={select.onChange}
                      emptyLabel="Выберите атрибут"
                      invalid={Boolean(rowErrors?.attribute_id)}
                      autoFocus={addedIndex === index}
                      onCreate={(name) => setCreating({ index, name })}
                    />
                  )}
                />
              </div>
              <div>
                <label htmlFor={valueId} className="sr-only">{`Значение (${locale.toUpperCase()})`}</label>
                <input
                  key={locale}
                  id={valueId}
                  className={inputClass}
                  placeholder={locale === 'kk' ? rows[index]?.value.ru || 'Қазақша' : 'Значение'}
                  aria-invalid={Boolean(rowErrors?.value?.[locale]) || undefined}
                  {...register(`attribute_values.${index}.value.${locale}`)}
                />
              </div>
              <button
                type="button"
                onClick={() => remove(index)}
                aria-label="Удалить характеристику"
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-zinc-400 hover:bg-zinc-100 hover:text-red-600 md:h-9 md:w-9"
              >
                ✕
              </button>
              {message && (
                <p role="alert" className="col-span-full text-xs text-red-600">
                  {message}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        className={buttonSecondary}
        onClick={() => {
          setAddedIndex(fields.length);
          append(emptyAttributeRow(), { shouldFocus: false });
        }}
      >
        + Добавить характеристику
      </button>

      {creating && (
        <AttributeFormSheet
          attribute={null}
          initialName={creating.name}
          onSaved={(attribute) => {
            onAttributeCreated(attribute);
            setValue(`attribute_values.${creating.index}.attribute_id`, String(attribute.id), { shouldDirty: true, shouldValidate: true });
          }}
          onClose={() => setCreating(null)}
        />
      )}
    </div>
  );
}
