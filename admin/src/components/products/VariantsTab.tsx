'use client';

import { useEffect, useState } from 'react';
import { useWatch, type UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import AttributeRows from '@/components/catalog/AttributeRows';
import { attributeRowsPayload, attributeRowsSchema, toAttributeRows, type ApiAttributeValue } from '@/components/catalog/attributeRows';
import ConfirmButton from '@/components/ui/ConfirmButton';
import CrudModal from '@/components/ui/CrudModal';
import DataTable, { type Column } from '@/components/ui/DataTable';
import Field from '@/components/ui/Field';
import LocaleSwitch, { type Locale } from '@/components/ui/LocaleSwitch';
import MoneyInput from '@/components/ui/MoneyInput';
import { buttonLink, buttonPrimary, inputClass } from '@/components/ui/styles';
import type { Attribute } from '@/lib/catalogTypes';
import { useResource, type Resource } from '@/lib/crud';
import { formatTenge, TENGE_PATTERN, tiynToTenge } from '@/lib/money';
import { ru } from '@/lib/text';
import { REQUIRED } from '@/lib/validation';
import type { ProductImage } from './form/photos';
import VariantPhotoPicker from './VariantPhotoPicker';

type Variant = {
  id: number;
  name: string;
  code: string | null;
  retail_price: number | null;
  b2b_price: number | null;
  stock: string;
  barcodes: string[] | null;
  attribute_values: ApiAttributeValue[];
  images: ProductImage[];
};

const optionalTenge = z.string().refine((v) => v === '' || TENGE_PATTERN.test(v), 'Сумма в ₸, до двух знаков после точки');

const schema = z.object({
  name: z.string().min(1, REQUIRED).max(255),
  code: z.string().max(255),
  retail_price: optionalTenge,
  b2b_price: optionalTenge,
  barcodes: z.string(),
  attribute_values: attributeRowsSchema,
  media_ids: z.array(z.number()),
});

type VariantForm = z.infer<typeof schema>;

const toForm = (v: Variant | null): VariantForm => ({
  name: v?.name ?? '',
  code: v?.code ?? '',
  retail_price: tiynToTenge(v?.retail_price),
  b2b_price: tiynToTenge(v?.b2b_price),
  barcodes: (v?.barcodes ?? []).join('\n'),
  attribute_values: toAttributeRows(v?.attribute_values),
  media_ids: (v?.images ?? []).map((image) => image.id),
});

const toPayload = (f: VariantForm) => ({
  name: f.name,
  code: f.code,
  retail_price: f.retail_price,
  b2b_price: f.b2b_price,
  barcodes: f.barcodes.split('\n').map((s) => s.trim()).filter(Boolean),
  attribute_values: attributeRowsPayload(f.attribute_values),
  media_ids: f.media_ids,
});

/** «Серый · 200×90» — значения характеристик одной строкой. */
const summary = (v: Variant): string => v.attribute_values.map((a) => ru(a.value)).filter(Boolean).join(' · ');

type Props = {
  productId: number;
  onCount?: (count: number) => void;
  /** Галерея товара — из неё отмечаются фото варианта. */
  images: Resource<ProductImage>;
  attributes: Attribute[];
  onAttributeCreated: (attribute: Attribute) => void;
};

export default function VariantsTab({ productId, onCount, images, attributes, onAttributeCreated }: Props) {
  const variants = useResource<Variant>(`/admin/products/${productId}/variants`);
  const [editing, setEditing] = useState<Variant | null | undefined>(undefined);
  const [uploading, setUploading] = useState(false);

  // Счётчик для заголовка блока — только когда список уже загружен.
  useEffect(() => {
    if (!variants.loading) {
      onCount?.(variants.items.length);
    }
  }, [variants.loading, variants.items.length, onCount]);

  const columns: Column<Variant>[] = [
    {
      key: 'name',
      header: 'Вариант',
      mobile: 'title',
      render: (v) => (
        <div className="flex items-center gap-3">
          {v.images[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={v.images[0].thumb_url} alt="" className="h-10 w-10 shrink-0 rounded-md object-cover" />
          ) : (
            <span aria-hidden className="h-10 w-10 shrink-0 rounded-md bg-zinc-100" />
          )}
          <div className="min-w-0">
            <span className="font-medium text-zinc-900">{v.name}</span>
            {summary(v) && <span className="block truncate text-xs text-zinc-500">{summary(v)}</span>}
          </div>
        </div>
      ),
    },
    { key: 'code', header: 'Код', mobile: 'meta', render: (v) => v.code ?? '—' },
    { key: 'retail', header: 'Розница', render: (v) => formatTenge(v.retail_price) },
    { key: 'b2b', header: 'Опт', render: (v) => formatTenge(v.b2b_price) },
    { key: 'stock', header: 'Остаток', render: (v) => Number(v.stock) },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      mobile: 'actions',
      render: (v) => (
        <div className="flex justify-end gap-4">
          <button type="button" className={buttonLink} onClick={() => setEditing(v)}>Изменить</button>
          <ConfirmButton onConfirm={() => variants.remove(v.id)}>Удалить</ConfirmButton>
        </div>
      ),
    },
  ];

  const close = () => {
    setEditing(undefined);
    setUploading(false);
  };

  return (
    <div className="space-y-4">
      <button type="button" className={buttonPrimary} onClick={() => setEditing(null)}>Добавить вариант</button>
      <DataTable columns={columns} rows={variants.items} loading={variants.loading} emptyText="Вариантов нет" />

      {editing !== undefined && (
        <CrudModal
          title={editing ? 'Изменить вариант' : 'Новый вариант'}
          schema={schema}
          defaultValues={toForm(editing)}
          submitDisabled={uploading}
          onSubmit={(f) => (editing ? variants.update(editing.id, toPayload(f)) : variants.create(toPayload(f)))}
          onClose={close}
        >
          {(form) => (
            <VariantFields
              form={form}
              productId={productId}
              images={images}
              attributes={attributes}
              onAttributeCreated={onAttributeCreated}
              onUploadingChange={setUploading}
            />
          )}
        </CrudModal>
      )}
    </div>
  );
}

type FieldsProps = {
  form: UseFormReturn<VariantForm>;
  productId: number;
  images: Resource<ProductImage>;
  attributes: Attribute[];
  onAttributeCreated: (attribute: Attribute) => void;
  onUploadingChange: (uploading: boolean) => void;
};

/** Поля окна варианта — отдельным компонентом, чтобы в нём работали хуки. */
function VariantFields({ form, productId, images, attributes, onAttributeCreated, onUploadingChange }: FieldsProps) {
  const [locale, setLocale] = useState<Locale>('ru');
  const selected = useWatch({ control: form.control, name: 'media_ids' });
  const { errors } = form.formState;

  const setPhotos = (ids: number[]) => form.setValue('media_ids', ids, { shouldDirty: true });

  return (
    <>
      <Field label="Название *" htmlFor="v-name" error={errors.name?.message}>
        <input id="v-name" className={inputClass} {...form.register('name')} />
      </Field>
      <Field label="Код" htmlFor="v-code" error={errors.code?.message}>
        <input id="v-code" className={inputClass} {...form.register('code')} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Розничная цена, ₸" htmlFor="v-retail" error={errors.retail_price?.message}>
          <MoneyInput id="v-retail" {...form.register('retail_price')} />
        </Field>
        <Field label="Оптовая цена, ₸" htmlFor="v-b2b" error={errors.b2b_price?.message}>
          <MoneyInput id="v-b2b" {...form.register('b2b_price')} />
        </Field>
      </div>

      <section aria-label="Характеристики варианта" className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-medium text-zinc-700">Характеристики</h3>
          <LocaleSwitch value={locale} onChange={setLocale} />
        </div>
        <AttributeRows form={form} attributes={attributes} onAttributeCreated={onAttributeCreated} locale={locale} />
      </section>

      <section aria-label="Фото варианта" className="space-y-2">
        <h3 className="text-sm font-medium text-zinc-700">Фото</h3>
        <VariantPhotoPicker
          productId={productId}
          images={images.items}
          selected={selected}
          onToggle={(id) => {
            const current = form.getValues('media_ids');
            setPhotos(current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
          }}
          onUploaded={(image) => {
            setPhotos([...form.getValues('media_ids'), image.id]);
            void images.reload();
          }}
          onUploadingChange={onUploadingChange}
        />
      </section>

      <details className="rounded-xl border border-zinc-200 px-3">
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-zinc-700 md:min-h-9">Ещё</summary>
        <div className="pb-3">
          <Field label="Штрихкоды" htmlFor="v-barcodes" hint="По одному на строку" error={errors.barcodes?.message}>
            <textarea id="v-barcodes" rows={2} className={inputClass} {...form.register('barcodes')} />
          </Field>
        </div>
      </details>
      <p className="text-xs text-zinc-500">Остаток варианта здесь не меняется — только приёмками и заказами.</p>
    </>
  );
}
