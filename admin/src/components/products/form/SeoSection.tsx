'use client';

import { useWatch, type UseFormReturn } from 'react-hook-form';
import Collapsible from '@/components/ui/Collapsible';
import Field from '@/components/ui/Field';
import LocaleSwitch, { LOCALES, type Locale } from '@/components/ui/LocaleSwitch';
import { inputClass } from '@/components/ui/styles';
import { STOREFRONT_URL } from '@/lib/api';
import type { ProductFormValues } from './formModel';

const STOREFRONT_HOST = STOREFRONT_URL.replace(/^https?:\/\//, '');

type Props = {
  form: UseFormReturn<ProductFormValues>;
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  /** Адрес, сохранённый в базе; null у нового товара. */
  savedSlug: string | null;
  open: boolean;
  onToggle: (open: boolean) => void;
};

/** Счётчик-ориентир для поисковиков: превышение — жёлтым, но не ошибка. */
function Counter({ value, max }: { value: string; max: number }) {
  return (
    <p className={`text-right text-xs ${value.length > max ? 'text-amber-600' : 'text-zinc-400'}`}>
      {value.length} / {max}
    </p>
  );
}

export default function SeoSection({ form, locale, onLocaleChange, savedSlug, open, onToggle }: Props) {
  const {
    register,
    control,
    formState: { errors },
  } = form;
  const [slug, title, description] = useWatch({ control, name: ['slug', 'seo_title', 'seo_description'] });
  const slugChanged = Boolean(savedSlug) && slug !== savedSlug;
  const filled = slug !== '' || [title, description].some((p) => p.ru !== '' || p.kk !== '');
  const missingKk = (title.ru !== '' && title.kk === '') || (description.ru !== '' && description.kk === '');

  return (
    <Collapsible
      id="seo"
      title="SEO — адрес и поисковики"
      summary={filled ? 'заполнено' : 'заполнено автоматически'}
      open={open}
      onToggle={onToggle}
    >
      <div className="space-y-4">
        <Field
          label="Адрес страницы"
          htmlFor="slug"
          hint={slug === '' ? 'Пусто — создастся из названия' : undefined}
          error={errors.slug?.message}
        >
          <input id="slug" className={inputClass} placeholder="divan-atlanta" aria-invalid={errors.slug ? true : undefined} {...register('slug')} />
        </Field>
        <p className="break-all text-xs text-zinc-500">
          {STOREFRONT_HOST}/product/{slug || '…'}
        </p>
        {slugChanged && (
          <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Старые ссылки на товар перестанут работать.
          </p>
        )}

        <div className="flex justify-end">
          <LocaleSwitch
            value={locale}
            onChange={onLocaleChange}
            missing={{ kk: missingKk }}
            invalid={{
              ru: Boolean(errors.seo_title?.ru || errors.seo_description?.ru),
              kk: Boolean(errors.seo_title?.kk || errors.seo_description?.kk),
            }}
          />
        </div>

        {LOCALES.map((l) => (
          <div key={l} hidden={locale !== l} className="space-y-4">
            <Field
              label={l === 'ru' ? 'Заголовок для поисковиков' : 'Заголовок для поисковиков на казахском'}
              htmlFor={`seo_title-${l}`}
              error={errors.seo_title?.[l]?.message}
            >
              <input
                id={`seo_title-${l}`}
                className={inputClass}
                placeholder="Пусто — возьмём название"
                aria-invalid={errors.seo_title?.[l] ? true : undefined}
                {...register(`seo_title.${l}`)}
              />
              <Counter value={title[l]} max={60} />
            </Field>
            <Field
              label={l === 'ru' ? 'Описание для поисковиков' : 'Описание для поисковиков на казахском'}
              htmlFor={`seo_description-${l}`}
              error={errors.seo_description?.[l]?.message}
            >
              <textarea
                id={`seo_description-${l}`}
                rows={3}
                className={`${inputClass} resize-y`}
                placeholder="Пусто — возьмём название"
                aria-invalid={errors.seo_description?.[l] ? true : undefined}
                {...register(`seo_description.${l}`)}
              />
              <Counter value={description[l]} max={160} />
            </Field>
          </div>
        ))}
      </div>
    </Collapsible>
  );
}
