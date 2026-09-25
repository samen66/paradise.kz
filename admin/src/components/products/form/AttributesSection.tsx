'use client';

import { useWatch, type UseFormReturn } from 'react-hook-form';
import AttributeRows from '@/components/catalog/AttributeRows';
import LocaleSwitch, { type Locale } from '@/components/ui/LocaleSwitch';
import type { Attribute } from '@/lib/catalogTypes';
import FormCard from './FormCard';
import type { ProductFormValues } from './formModel';

type Props = {
  form: UseFormReturn<ProductFormValues>;
  attributes: Attribute[];
  onAttributeCreated: (attribute: Attribute) => void;
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  className?: string;
};

/** Характеристики товара — часть основной формы, сохраняются общей кнопкой. */
export default function AttributesSection({ form, attributes, onAttributeCreated, locale, onLocaleChange, className }: Props) {
  const rows = useWatch({ control: form.control, name: 'attribute_values' });
  const errors = form.formState.errors.attribute_values;
  const missingKk = rows.some((row) => row.value.ru.trim() !== '' && row.value.kk.trim() === '');
  const invalid = (locale: Locale) => rows.some((_, index) => Boolean(errors?.[index]?.value?.[locale]));

  return (
    <FormCard
      id="attributes"
      title="Характеристики"
      className={className}
      aside={<LocaleSwitch value={locale} onChange={onLocaleChange} missing={{ kk: missingKk }} invalid={{ ru: invalid('ru'), kk: invalid('kk') }} />}
    >
      <AttributeRows form={form} attributes={attributes} onAttributeCreated={onAttributeCreated} locale={locale} />
    </FormCard>
  );
}
