'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import ProductRelations from '@/components/products/ProductRelations';
import type { Locale } from '@/components/ui/LocaleSwitch';
import PageHeader from '@/components/ui/PageHeader';
import SaveBar from '@/components/ui/SaveBar';
import { buttonSecondary, cardClass } from '@/components/ui/styles';
import api, { STOREFRONT_URL } from '@/lib/api';
import { applyServerErrors } from '@/lib/errors';
import { ru } from '@/lib/text';
import { toast } from '@/stores/toastStore';
import AccountingCard from './AccountingCard';
import BasicSection from './BasicSection';
import CatalogCard from './CatalogCard';
import DimensionsCard from './DimensionsCard';
import PhotosSection from './PhotosSection';
import PriceSection from './PriceSection';
import SeoSection from './SeoSection';
import StatusCard from './StatusCard';
import StockCard from './StockCard';
import {
  emptyProductValues,
  productSchema,
  toFormData,
  toFormValues,
  type ApiProduct,
  type NamedOption,
  type ProductFormValues,
} from './formModel';
import { uploadPhoto, type QueuedPhoto } from './photos';

type Props = { initialProduct: ApiProduct | null; categories: NamedOption[]; brands: NamedOption[] };

/**
 * Карточка товара: создание и правка на одной странице.
 *
 * Основные поля — одна форма react-hook-form; сохраняет её кнопка нижней
 * панели. Элемента `<form>` нет намеренно: блоки со списками открывают
 * CrudModal со своим `<form>`, а Modal рисуется на месте, не в портале, —
 * вложенная форма в HTML недопустима.
 *
 * Раскладка: с `lg` две колонки; до `lg` колонки становятся `contents`, и
 * карточки выстраиваются одной лентой по своим `order-*`.
 */
export default function ProductForm({ initialProduct, categories, brands }: Props) {
  const [product, setProduct] = useState<ApiProduct | null>(initialProduct);
  const productId = product?.id ?? null;
  const rootRef = useRef<HTMLDivElement>(null);
  const [basicLocale, setBasicLocale] = useState<Locale>('ru');
  const [seoLocale, setSeoLocale] = useState<Locale>('ru');
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const [queue, setQueue] = useState<QueuedPhoto[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const queueRef = useRef(queue);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  // Превью очереди — object URL; при уходе со страницы их надо освободить.
  useEffect(() => () => queueRef.current.forEach((p) => URL.revokeObjectURL(p.preview)), []);

  /** Грузит очередь по одному, в выбранном порядке; не загрузившиеся остаются в очереди с пометкой. */
  const uploadQueue = async (id: number, photos: QueuedPhoto[]): Promise<void> => {
    for (const [index, photo] of photos.entries()) {
      setStatus(`Загружаем фото ${index + 1} из ${photos.length}`);
      setQueue((q) => q.map((p) => (p.key === photo.key ? { ...p, status: 'uploading' } : p)));

      try {
        await uploadPhoto(id, photo.file);
        URL.revokeObjectURL(photo.preview);
        setQueue((q) => q.filter((p) => p.key !== photo.key));
      } catch (error) {
        const message = (error as Error).message;
        setQueue((q) => q.map((p) => (p.key === photo.key ? { ...p, status: 'failed', error: message } : p)));
        toast.error(`${photo.file.name}: ${message}`);
      }
    }

    setStatus(null);
  };

  const form = useForm<ProductFormValues>({
    // Схема не приводит типы (числа остаются строками) — вход и выход совпадают.
    resolver: zodResolver(productSchema) as unknown as Resolver<ProductFormValues>,
    defaultValues: initialProduct ? toFormValues(initialProduct) : emptyProductValues(),
  });
  const { isDirty, isSubmitting } = form.formState;

  const toggle = (id: string) => (next: boolean) =>
    setOpen((prev) => {
      const copy = new Set(prev);
      if (next) {
        copy.add(id);
      } else {
        copy.delete(id);
      }

      return copy;
    });

  const save = form.handleSubmit(async (values) => {
    const isCreate = productId === null;

    try {
      const res = await api.post<{ data: ApiProduct }>(
        isCreate ? '/admin/products' : `/admin/products/${productId}`,
        toFormData(values, !isCreate),
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      const saved = res.data.data;

      form.reset(toFormValues(saved));

      if (isCreate) {
        // Не router.replace: смена сегмента [id] могла бы перемонтировать
        // страницу вместе с формой и очередью фото. history.replaceState
        // Next.js поддерживает (docs: linking-and-navigating, «Native History
        // API») — меняется только адрес.
        window.history.replaceState(null, '', `/products/${saved.id}`);
        // Товар «становится сохранённым» только после загрузки фото: пока
        // productId пуст, раздел фото показывает очередь с ходом загрузки.
        await uploadQueue(saved.id, queue);
        setProduct(saved);
        toast.success('Товар создан');
      } else {
        setProduct(saved);
        toast.success('Сохранено');
      }
    } catch (error) {
      const message = applyServerErrors(error, form.setError);

      if (message) {
        toast.error(message);
      }
    }
  });

  const title = product ? ru(product.name) || `Товар #${product.id}` : 'Новый товар';

  return (
    <div ref={rootRef} className="pb-24 lg:pb-0">
      <PageHeader
        title={title}
        back="/products"
        actions={
          product && (
            <>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  product.is_active ? 'bg-green-100 text-green-800' : 'bg-zinc-200 text-zinc-700'
                }`}
              >
                {product.is_active ? 'На витрине' : 'Скрыт'}
              </span>
              {product.slug && (
                <a href={`${STOREFRONT_URL}/product/${product.slug}`} target="_blank" rel="noopener noreferrer" className={buttonSecondary}>
                  Открыть на сайте ↗
                </a>
              )}
            </>
          )
        }
      />

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-3 lg:items-start lg:gap-6">
        <div className="contents lg:col-span-2 lg:flex lg:flex-col lg:gap-4">
          <BasicSection form={form} locale={basicLocale} onLocaleChange={setBasicLocale} className="order-1 lg:order-none" />
          <PhotosSection productId={productId} queue={queue} onQueueChange={setQueue} busy={isSubmitting} className="order-2 lg:order-none" />
          <PriceSection
            form={form}
            extrasOpen={open.has('price-extra')}
            onExtrasToggle={toggle('price-extra')}
            className="order-3 lg:order-none"
          />
          {productId !== null && (
            <section className={`${cardClass} order-9 p-4 md:p-5 lg:order-none`}>
              <ProductRelations productId={productId} />
            </section>
          )}
          <div className="order-13 lg:order-none">
            <SeoSection
              form={form}
              locale={seoLocale}
              onLocaleChange={setSeoLocale}
              savedSlug={product?.slug ?? null}
              open={open.has('seo')}
              onToggle={toggle('seo')}
            />
          </div>
        </div>

        <div className="contents lg:flex lg:flex-col lg:gap-4">
          <StatusCard form={form} className="order-4 lg:order-none" />
          <CatalogCard form={form} categories={categories} brands={brands} className="order-5 lg:order-none" />
          <AccountingCard form={form} className="order-6 lg:order-none" />
          {product && <StockCard product={product} className="order-7 lg:order-none" />}
          <DimensionsCard form={form} className="order-8 lg:order-none" />
        </div>
      </div>

      <SaveBar
        dirty={isDirty || (productId === null && queue.length > 0)}
        canSave={productId === null || isDirty}
        saving={isSubmitting}
        status={status}
        onSave={() => void save()}
        onReset={() => form.reset()}
      />
    </div>
  );
}
