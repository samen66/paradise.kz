'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Controller, useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import FormCard from '@/components/products/form/FormCard';
import PhotosSection from '@/components/products/form/PhotosSection';
import type { QueuedPhoto } from '@/components/products/form/photos';
import Field from '@/components/ui/Field';
import PageHeader from '@/components/ui/PageHeader';
import SaveBar from '@/components/ui/SaveBar';
import SectionNav from '@/components/ui/SectionNav';
import Switch from '@/components/ui/Switch';
import TranslatableField from '@/components/ui/TranslatableField';
import { buttonLink, buttonSecondary, inputClass } from '@/components/ui/styles';
import api from '@/lib/api';
import { applyServerErrors } from '@/lib/errors';
import {
  SHOWROOM_SERVICES,
  STATUS_CHIP,
  showroomSchema,
  showroomStatus,
  toShowroomForm,
  toShowroomPayload,
  type Showroom,
  type ShowroomFormValues,
} from '@/lib/showrooms';
import { plural } from '@/lib/text';
import { useUnsavedGuard } from '@/lib/useUnsavedGuard';
import { toast } from '@/stores/toastStore';
import HoursCard from './HoursCard';
import MapCard from './MapCard';

const SECTIONS = [
  { id: 'basic', label: 'Основное' },
  { id: 'about', label: 'Описание' },
  { id: 'contacts', label: 'Контакты' },
  { id: 'hours', label: 'Часы' },
  { id: 'services', label: 'Услуги' },
  { id: 'map', label: 'Карта' },
  { id: 'photos', label: 'Фото' },
];

const LEFT = 'lg:col-span-2 lg:col-start-1';

/**
 * Карточка шоурума. Поля — одна форма и один PUT по кнопке нижней панели;
 * фото загружаются сразу, мимо неё (раздел фото общий с товаром).
 */
export default function ShowroomForm({ initial }: { initial: Showroom }) {
  const [showroom, setShowroom] = useState(initial);
  const rootRef = useRef<HTMLDivElement>(null);
  // Очереди у шоурума не бывает: он создан до открытия карточки.
  const [queue, setQueue] = useState<QueuedPhoto[]>([]);
  const [saving, setSaving] = useState(false);

  const form = useForm<ShowroomFormValues>({
    resolver: zodResolver(showroomSchema) as unknown as Resolver<ShowroomFormValues>,
    defaultValues: toShowroomForm(initial),
  });
  const { register, control, formState, watch } = form;
  const { errors, isDirty } = formState;
  const slug = watch('slug');

  useUnsavedGuard(isDirty && !saving);

  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const revealFirstError = () =>
    requestAnimationFrame(() =>
      rootRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], [role="alert"]')?.scrollIntoView({ block: 'center', behavior: 'smooth' }),
    );

  const onValid = async (values: ShowroomFormValues) => {
    try {
      const res = await api.put<{ data: Showroom }>(`/admin/showrooms/${showroom.id}`, toShowroomPayload(values));
      setShowroom(res.data.data);
      form.reset(toShowroomForm(res.data.data));
      toast.success('Сохранено');
    } catch (error) {
      const message = applyServerErrors(error, form.setError);
      if (message) {
        toast.error(message);
      }
      revealFirstError();
    }
  };

  const save = async () => {
    if (saving) {
      return;
    }
    setSaving(true);
    try {
      await form.handleSubmit(onValid, revealFirstError)();
    } finally {
      setSaving(false);
    }
  };

  const chip = STATUS_CHIP[showroomStatus(showroom)];
  const inStock = showroom.products_in_stock ?? 0;

  return (
    <div ref={rootRef} className="pb-24 lg:pb-0">
      <PageHeader
        title={showroom.name}
        back="/showrooms"
        below={<SectionNav sections={SECTIONS} onJump={jump} />}
        actions={
          <>
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${chip.className}`}>{chip.label}</span>
            {showroom.public_url && (
              <a href={showroom.public_url} target="_blank" rel="noopener noreferrer" className={buttonSecondary}>
                Открыть на сайте ↗
              </a>
            )}
          </>
        }
      />

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-3 lg:items-start lg:gap-x-6 lg:gap-y-4">
        <FormCard id="basic" title="Основное" className={LEFT}>
          <Field label="Название *" htmlFor="sr-name" error={errors.name?.message}>
            <input id="sr-name" className={inputClass} aria-invalid={errors.name ? 'true' : undefined} {...register('name')} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Адрес страницы (slug)" htmlFor="sr-slug" error={errors.slug?.message} hint={slug ? `/showrooms/${slug}` : 'Нужен, чтобы показать на сайте'}>
              <input id="sr-slug" className={inputClass} aria-invalid={errors.slug ? 'true' : undefined} {...register('slug')} />
            </Field>
            <Field label="Город" htmlFor="sr-city" error={errors.city?.message}>
              <input id="sr-city" className={inputClass} {...register('city')} />
            </Field>
          </div>
          <Field label="Адрес" htmlFor="sr-address" error={errors.address?.message}>
            <input id="sr-address" className={inputClass} {...register('address')} />
          </Field>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="Площадь" htmlFor="sr-area" error={errors.area?.message}>
              <input id="sr-area" className={inputClass} placeholder="780 м²" {...register('area')} />
            </Field>
            <Field label="Этажность" htmlFor="sr-floors" error={errors.floors?.message}>
              <input id="sr-floors" className={inputClass} placeholder="2 этажа" {...register('floors')} />
            </Field>
            <Field label="Порядок" htmlFor="sr-sort" error={errors.sort_order?.message}>
              <input id="sr-sort" inputMode="numeric" className={inputClass} {...register('sort_order')} />
            </Field>
          </div>
        </FormCard>

        <div className="flex flex-col gap-4 lg:col-start-3 lg:row-span-7 lg:row-start-1">
          <FormCard id="status" title="Публикация">
            <Controller
              control={control}
              name="show_on_site"
              render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label="Показывать на сайте" />}
            />
            {errors.show_on_site?.message && (
              <p role="alert" className="text-xs text-red-600">
                {errors.show_on_site.message}
              </p>
            )}
            <Controller
              control={control}
              name="is_flagship"
              render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label="Флагман" />}
            />
            {!showroom.is_active && (
              <p className="text-xs text-amber-700">
                Склад выключен — на сайте шоурума не будет. Включается в{' '}
                <Link href="/warehouse/stores" className={buttonLink}>
                  «Места хранения»
                </Link>
                .
              </p>
            )}
          </FormCard>
          <FormCard id="stock" title="Наличие">
            <p className="text-sm text-zinc-700">
              В остатке {inStock} {plural(inStock, ['товар', 'товара', 'товаров'])}
            </p>
            <Link href={`/warehouse/stock?store_id=${showroom.id}`} className={buttonLink}>
              Остатки этого склада →
            </Link>
          </FormCard>
        </div>

        <FormCard id="about" title="Описание" className={LEFT}>
          <TranslatableField form={form} name="landmark" label="Ориентир" />
          <TranslatableField form={form} name="parking" label="Парковка" />
          <TranslatableField form={form} name="description" label="О шоуруме" multiline />
        </FormCard>

        <FormCard id="contacts" title="Контакты" className={LEFT}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Телефон" htmlFor="sr-phone" error={errors.phone?.message}>
              <input id="sr-phone" type="tel" className={inputClass} placeholder="+7 (727) 355-11-00" {...register('phone')} />
            </Field>
            <Field label="WhatsApp" htmlFor="sr-wa" error={errors.whatsapp?.message} hint="Номер с 7, без плюса: 77001112233">
              <input id="sr-wa" inputMode="numeric" className={inputClass} aria-invalid={errors.whatsapp ? 'true' : undefined} {...register('whatsapp')} />
            </Field>
          </div>
          {/^7\d{10}$/.test(watch('whatsapp')) && (
            <a href={`https://wa.me/${watch('whatsapp')}`} target="_blank" rel="noopener noreferrer" className={buttonLink}>
              Проверить WhatsApp ↗
            </a>
          )}
        </FormCard>

        <HoursCard form={form} className={LEFT} />

        <FormCard id="services" title="Услуги" className={LEFT}>
          <Controller
            control={control}
            name="services"
            render={({ field }) => (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {SHOWROOM_SERVICES.map((service) => (
                  <label key={service.key} className="flex min-h-11 items-center gap-2 text-sm text-zinc-700 md:min-h-0">
                    <input
                      type="checkbox"
                      checked={field.value.includes(service.key)}
                      onChange={(e) =>
                        field.onChange(e.target.checked ? [...field.value, service.key] : field.value.filter((key) => key !== service.key))
                      }
                    />
                    {service.label}
                  </label>
                ))}
              </div>
            )}
          />
        </FormCard>

        <MapCard form={form} className={LEFT} />

        <PhotosSection mediaPath={`/admin/showrooms/${showroom.id}/photos`} queue={queue} onQueueChange={setQueue} busy={saving} className={LEFT} />
      </div>

      <SaveBar dirty={isDirty} canSave={isDirty} saving={saving} onSave={() => void save()} onReset={() => form.reset()} />
    </div>
  );
}
