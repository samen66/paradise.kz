'use client';

import { useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import FormCard from '@/components/products/form/FormCard';
import Field from '@/components/ui/Field';
import { buttonSecondary, inputClass } from '@/components/ui/styles';
import { coordsFrom2gis, twoGisUrl, type ShowroomFormValues } from '@/lib/showrooms';

/** Точка на карте: вставить ссылку из 2ГИС или ввести координаты руками. */
export default function MapCard({ form, className }: { form: UseFormReturn<ShowroomFormValues>; className?: string }) {
  const { register, setValue, watch, formState } = form;
  const [link, setLink] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const lat = watch('lat');
  const lng = watch('lng');

  const applyLink = (value: string) => {
    setLink(value);

    if (value.trim() === '') {
      setLinkError(null);
      return;
    }

    const coords = coordsFrom2gis(value);

    if (!coords) {
      setLinkError('Не нашли координаты в ссылке — откройте точку в 2ГИС и скопируйте адрес страницы');
      return;
    }

    setLinkError(null);
    setValue('lat', String(coords.lat), { shouldDirty: true, shouldValidate: true });
    setValue('lng', String(coords.lng), { shouldDirty: true, shouldValidate: true });
  };

  return (
    <FormCard id="map" title="Карта" className={className}>
      <Field label="Ссылка из 2ГИС" htmlFor="showroom-2gis" error={linkError ?? undefined} hint="Координаты подставятся сами">
        <input id="showroom-2gis" className={inputClass} value={link} onChange={(e) => applyLink(e.target.value)} placeholder="https://2gis.kz/almaty/geo/…" />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Широта" htmlFor="showroom-lat" error={formState.errors.lat?.message}>
          <input id="showroom-lat" inputMode="decimal" className={inputClass} aria-invalid={formState.errors.lat ? 'true' : undefined} {...register('lat')} />
        </Field>
        <Field label="Долгота" htmlFor="showroom-lng" error={formState.errors.lng?.message}>
          <input id="showroom-lng" inputMode="decimal" className={inputClass} aria-invalid={formState.errors.lng ? 'true' : undefined} {...register('lng')} />
        </Field>
      </div>
      {lat !== '' && lng !== '' && (
        <a href={twoGisUrl(lat, lng)} target="_blank" rel="noopener noreferrer" className={buttonSecondary}>
          Открыть в 2ГИС ↗
        </a>
      )}
    </FormCard>
  );
}
