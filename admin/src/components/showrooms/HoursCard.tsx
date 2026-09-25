'use client';

import { Controller, get, type UseFormReturn } from 'react-hook-form';
import FormCard from '@/components/products/form/FormCard';
import Switch from '@/components/ui/Switch';
import { buttonLink, inputClass } from '@/components/ui/styles';
import { DAY_LABELS, type ShowroomFormValues } from '@/lib/showrooms';

/** Часы работы: семь строк Пн→Вс, у каждой «работает» и время. */
export default function HoursCard({ form, className }: { form: UseFormReturn<ShowroomFormValues>; className?: string }) {
  const { control, register, getValues, setValue, watch, formState } = form;
  const days = watch('weekly_hours');

  const copyMonday = () => {
    const monday = getValues('weekly_hours.0');
    DAY_LABELS.forEach((_, index) => {
      if (index > 0) {
        setValue(`weekly_hours.${index}`, { ...monday }, { shouldDirty: true, shouldValidate: formState.isSubmitted });
      }
    });
  };

  return (
    <FormCard
      id="hours"
      title="Часы работы"
      className={className}
      aside={
        <button type="button" className={buttonLink} onClick={copyMonday}>
          Как в понедельник — на все дни
        </button>
      }
    >
      <ul className="divide-y divide-zinc-100">
        {DAY_LABELS.map((label, index) => {
          const error = get(formState.errors, `weekly_hours.${index}`)?.message as string | undefined;
          const enabled = days[index]?.enabled ?? false;

          return (
            <li key={label} className="py-2">
              <div className="flex flex-wrap items-center gap-3">
                <span className="w-8 text-sm font-medium text-zinc-700">{label}</span>
                <Controller
                  control={control}
                  name={`weekly_hours.${index}.enabled`}
                  render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label={field.value ? 'Работает' : 'Выходной'} />}
                />
                {enabled && (
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      aria-label={`${label}: открытие`}
                      aria-invalid={error ? 'true' : undefined}
                      className={`${inputClass} w-28`}
                      {...register(`weekly_hours.${index}.open`)}
                    />
                    <span className="text-zinc-400">—</span>
                    <input
                      type="time"
                      aria-label={`${label}: закрытие`}
                      aria-invalid={error ? 'true' : undefined}
                      className={`${inputClass} w-28`}
                      {...register(`weekly_hours.${index}.close`)}
                    />
                  </div>
                )}
              </div>
              {error && (
                <p role="alert" className="mt-1 text-xs text-red-600">
                  {error}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </FormCard>
  );
}
