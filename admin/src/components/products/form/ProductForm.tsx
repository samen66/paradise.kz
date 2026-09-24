'use client';

import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { isAxiosError } from 'axios';
import AttributeValuesTab from '@/components/products/AttributeValuesTab';
import ClientPricesTab from '@/components/products/ClientPricesTab';
import PricesTab from '@/components/products/PricesTab';
import VariantsTab from '@/components/products/VariantsTab';
import Collapsible from '@/components/ui/Collapsible';
import type { Locale } from '@/components/ui/LocaleSwitch';
import PageHeader from '@/components/ui/PageHeader';
import SaveBar from '@/components/ui/SaveBar';
import SectionNav from '@/components/ui/SectionNav';
import { buttonSecondary } from '@/components/ui/styles';
import api, { STOREFRONT_URL } from '@/lib/api';
import { applyServerErrors } from '@/lib/errors';
import { plural, ru } from '@/lib/text';
import { useUnsavedGuard } from '@/lib/useUnsavedGuard';
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
  errorPaths,
  productSchema,
  revealPlan,
  toFormData,
  toFormValues,
  type ApiProduct,
  type NamedOption,
  type ProductFormValues,
} from './formModel';
import { uploadPhoto, type QueuedPhoto } from './photos';

type Props = { initialProduct: ApiProduct | null; categories: NamedOption[]; brands: NamedOption[] };

type RelationTab = ComponentType<{ productId: number; onCount?: (count: number) => void }>;

/** Блоки со списками: сохраняются сразу, каждый в своём окне. `order` — место в ленте на телефоне. */
const RELATIONS: { id: string; title: string; forms: [string, string, string]; Tab: RelationTab; order: string }[] = [
  { id: 'prices', title: 'Цены по типам цен', forms: ['цена', 'цены', 'цен'], Tab: PricesTab, order: 'order-9 lg:order-none' },
  { id: 'client-prices', title: 'Цены для клиентов B2B', forms: ['цена', 'цены', 'цен'], Tab: ClientPricesTab, order: 'order-10 lg:order-none' },
  { id: 'attributes', title: 'Характеристики', forms: ['значение', 'значения', 'значений'], Tab: AttributeValuesTab, order: 'order-11 lg:order-none' },
  { id: 'variants', title: 'Варианты', forms: ['вариант', 'варианта', 'вариантов'], Tab: VariantsTab, order: 'order-12 lg:order-none' },
];

/** Полоса переходов на телефоне. Свёрнутые блоки (FOLDABLE) при переходе раскрываются. */
const SECTIONS = [
  { id: 'basic', label: 'Основное' },
  { id: 'photos', label: 'Фото' },
  { id: 'price', label: 'Цены' },
  { id: 'status', label: 'Статус' },
  { id: 'catalog', label: 'Каталог' },
  { id: 'attributes', label: 'Характеристики' },
  { id: 'variants', label: 'Варианты' },
  { id: 'seo', label: 'SEO' },
];

const FOLDABLE = new Set(['prices', 'client-prices', 'attributes', 'variants', 'seo']);

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
  const [counts, setCounts] = useState<Record<string, number>>({});
  // Сеттеры стабильны: вкладки держат onCount в зависимостях эффекта, и новый
  // колбэк на каждом рендере зациклил бы его.
  const countSetters = useMemo(
    () =>
      Object.fromEntries(
        RELATIONS.map((r) => [r.id, (n: number) => setCounts((c) => (c[r.id] === n ? c : { ...c, [r.id]: n }))]),
      ) as Record<string, (n: number) => void>,
    [],
  );
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

  // Во время сохранения не спрашиваем: форма сама меняет адрес после создания.
  useUnsavedGuard((isDirty || queue.length > 0) && !isSubmitting);

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

  const jump = (id: string) => {
    if (FOLDABLE.has(id)) {
      setOpen((prev) => new Set(prev).add(id));
    }

    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  /** Открывает блоки и язык с ошибками, потом прокручивает и ставит фокус на первое видимое поле. */
  const reveal = (paths: string[]) => {
    const plan = revealPlan(paths);

    if (plan.folds.length > 0) {
      setOpen((prev) => new Set([...prev, ...plan.folds]));
    }
    if (plan.basicLocale) {
      setBasicLocale(plan.basicLocale);
    }
    if (plan.seoLocale) {
      setSeoLocale(plan.seoLocale);
    }

    // Два кадра: React успевает раскрыть блоки и сменить язык, браузер — разложить их.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const fields = rootRef.current?.querySelectorAll<HTMLElement>('[aria-invalid="true"]') ?? [];
        const first = Array.from(fields).find((el) => el.offsetParent !== null);
        first?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        first?.focus({ preventScroll: true });
      }),
    );
  };

  const onValid = async (values: ProductFormValues) => {
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

      const serverPaths = isAxiosError<{ errors?: Record<string, string[]> }>(error)
        ? Object.keys(error.response?.data?.errors ?? {})
        : [];

      if (serverPaths.length > 0) {
        reveal(serverPaths);
      }
    }
  };

  // handleSubmit собирается при нажатии, а не при рендере: иначе React
  // Compiler видит обращение к ref (в reveal) во время рендера.
  const save = () => form.handleSubmit(onValid, (errors) => reveal(errorPaths(errors)))();

  const title = product ? ru(product.name) || `Товар #${product.id}` : 'Новый товар';

  return (
    <div ref={rootRef} className="pb-24 lg:pb-0">
      <PageHeader
        title={title}
        back="/products"
        below={<SectionNav sections={SECTIONS} onJump={jump} />}
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
          {RELATIONS.map(({ id, title, forms, Tab, order }) => {
            const count = counts[id];

            return (
              <div key={id} className={order}>
                <Collapsible
                  id={id}
                  title={title}
                  note="Сохраняется сразу"
                  summary={count === undefined ? null : count === 0 ? 'нет' : `${count} ${plural(count, forms)}`}
                  open={open.has(id)}
                  onToggle={toggle(id)}
                  disabledHint={productId === null ? 'Доступно после сохранения товара' : undefined}
                >
                  {productId !== null && <Tab productId={productId} onCount={countSetters[id]} />}
                </Collapsible>
              </div>
            );
          })}
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
