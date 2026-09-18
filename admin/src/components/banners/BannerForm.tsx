'use client';

import type { UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { optionalTranslatable } from '@/lib/validation';
import Field from '@/components/ui/Field';
import TranslatableField from '@/components/ui/TranslatableField';
import { inputClass } from '@/components/ui/styles';

/** Mirrors Banner::PLACEMENTS on the server. */
export const PLACEMENTS = {
  home_hero: 'Главная магазина',
  b2b_home: 'B2B-главная',
} as const;

export type Placement = keyof typeof PLACEMENTS;

export type Banner = {
  id: number;
  placement: Placement;
  title: { ru?: string; kk?: string };
  subtitle: { ru?: string; kk?: string };
  url: string | null;
  sort_order: number;
  is_active: boolean;
  image_url: string | null;
};

export const bannerSchema = z.object({
  placement: z.enum(['home_hero', 'b2b_home']),
  title: optionalTranslatable,
  subtitle: optionalTranslatable,
  url: z.string().max(2048),
  sort_order: z.string().regex(/^-?\d*$/, 'Целое число'),
  is_active: z.boolean(),
});

export type BannerFormValues = z.infer<typeof bannerSchema>;

export const toBannerForm = (b: Banner | null, placement: Placement = 'b2b_home'): BannerFormValues => ({
  placement: b?.placement ?? placement,
  title: { ru: b?.title?.ru ?? '', kk: b?.title?.kk ?? '' },
  subtitle: { ru: b?.subtitle?.ru ?? '', kk: b?.subtitle?.kk ?? '' },
  url: b?.url ?? '',
  sort_order: b ? String(b.sort_order) : '0',
  is_active: b?.is_active ?? true,
});

export function BannerFields({ form }: { form: UseFormReturn<BannerFormValues> }) {
  const { errors } = form.formState;

  return (
    <>
      <Field label="Место *" htmlFor="banner-placement" error={errors.placement?.message}>
        <select id="banner-placement" className={inputClass} {...form.register('placement')}>
          {Object.entries(PLACEMENTS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </Field>
      <TranslatableField form={form} name="title" label="Заголовок" />
      <TranslatableField form={form} name="subtitle" label="Подзаголовок" />
      <div className="grid grid-cols-2 gap-4">
        <Field label="Ссылка" htmlFor="banner-url" error={errors.url?.message} hint="Для главной магазина: например /catalog. На B2B-главной кнопка ведёт на регистрацию">
          <input id="banner-url" className={inputClass} {...form.register('url')} />
        </Field>
        <Field label="Порядок" htmlFor="banner-sort" error={errors.sort_order?.message}>
          <input id="banner-sort" type="number" className={inputClass} {...form.register('sort_order')} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-zinc-700">
        <input type="checkbox" {...form.register('is_active')} />
        Показывать
      </label>
    </>
  );
}
