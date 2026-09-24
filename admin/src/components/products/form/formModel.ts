import { z } from 'zod';
import { LOCALES } from '@/components/ui/LocaleSwitch';
import type { SelectOption } from '@/components/ui/SearchSelect';
import { TENGE_PATTERN, tiynToTenge } from '@/lib/money';
import { ru, type Translatable } from '@/lib/text';
import { REQUIRED, SLUG_PATTERN } from '@/lib/validation';

/**
 * Форма товара без React: схема, перевод товара из API в значения формы и
 * обратно, производные величины для подсказок.
 */

/** Товар, как его отдаёт `GET /admin/products/{id}` (переводы — объектом {ru, kk}). */
export type ApiProduct = {
  id: number;
  name: Translatable;
  description: Translatable;
  seo_title: Translatable;
  seo_description: Translatable;
  slug: string | null;
  code: string | null;
  article: string | null;
  category_id: number | null;
  brand_id: number | null;
  retail_price: number | null;
  b2b_price: number | null;
  compare_at_price: number | null;
  min_price: number | null;
  purchase_price: number | null;
  b2b_min_order_qty: number | null;
  uom: string | null;
  weight: string | number | null;
  volume: string | number | null;
  country: string | null;
  supplier: string | null;
  is_active: boolean;
  is_new_arrival: boolean;
  /** Проекция складского журнала, decimal:3. Сразу после создания в ответе её нет. */
  stock?: string | number | null;
};

/** Категория или бренд из `/admin/categories`, `/admin/brands`. */
export type NamedOption = { id: number; name?: Translatable; parent_id?: number | null };

const MONEY = 'Сумма в ₸, до двух знаков после точки';
const DECIMAL_3 = /^\d+(\.\d{1,3})?$/;

const upTo = (n: number) => z.string().max(n, `Не длиннее ${n} символов`);
const money = z.string().refine((v) => v === '' || TENGE_PATTERN.test(v), MONEY);
const decimal3 = z.string().refine((v) => v === '' || DECIMAL_3.test(v), 'Число, до трёх знаков после точки');

export const productSchema = z.object({
  name: z.object({ ru: z.string().trim().min(1, REQUIRED).max(255, 'Не длиннее 255 символов'), kk: upTo(255) }),
  description: z.object({ ru: z.string(), kk: z.string() }),
  seo_title: z.object({ ru: upTo(255), kk: upTo(255) }),
  seo_description: z.object({ ru: upTo(1000), kk: upTo(1000) }),
  slug: z.string().refine((v) => v === '' || SLUG_PATTERN.test(v), 'Только латиница в нижнем регистре, цифры и дефис'),
  code: upTo(255),
  article: upTo(255),
  category_id: z.string(),
  brand_id: z.string(),
  retail_price: money,
  b2b_price: money,
  compare_at_price: money,
  min_price: money,
  purchase_price: money,
  b2b_min_order_qty: z
    .string()
    .refine((v) => v === '' || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 1_000_000), 'Целое число от 1'),
  uom: upTo(50),
  weight: decimal3,
  volume: decimal3,
  country: upTo(255),
  supplier: upTo(255),
  is_active: z.boolean(),
  is_new_arrival: z.boolean(),
});

export type ProductFormValues = z.infer<typeof productSchema>;

export type MoneyField = 'retail_price' | 'b2b_price' | 'compare_at_price' | 'min_price' | 'purchase_price';

const TRANSLATABLE = ['name', 'description', 'seo_title', 'seo_description'] as const;

const SCALARS = [
  'slug', 'code', 'article', 'category_id', 'brand_id',
  'retail_price', 'b2b_price', 'compare_at_price', 'min_price', 'purchase_price',
  'b2b_min_order_qty', 'uom', 'weight', 'volume', 'country', 'supplier',
] as const;

const pair = (value: Translatable): { ru: string; kk: string } =>
  typeof value === 'string' ? { ru: value, kk: '' } : { ru: value?.ru ?? '', kk: value?.kk ?? '' };

const text = (value: unknown): string => (value === null || value === undefined ? '' : String(value));

/** decimal:3 из API («54.000») — без хвостовых нулей. */
const decimalText = (value: unknown): string => (value === null || value === undefined || value === '' ? '' : String(Number(value)));

export const emptyProductValues = (): ProductFormValues => ({
  name: { ru: '', kk: '' },
  description: { ru: '', kk: '' },
  seo_title: { ru: '', kk: '' },
  seo_description: { ru: '', kk: '' },
  slug: '', code: '', article: '', category_id: '', brand_id: '',
  retail_price: '', b2b_price: '', compare_at_price: '', min_price: '', purchase_price: '',
  b2b_min_order_qty: '', uom: '', weight: '', volume: '', country: '', supplier: '',
  is_active: true,
  is_new_arrival: false,
});

export const toFormValues = (p: ApiProduct): ProductFormValues => ({
  name: pair(p.name),
  description: pair(p.description),
  seo_title: pair(p.seo_title),
  seo_description: pair(p.seo_description),
  slug: text(p.slug),
  code: text(p.code),
  article: text(p.article),
  category_id: text(p.category_id),
  brand_id: text(p.brand_id),
  retail_price: tiynToTenge(p.retail_price),
  b2b_price: tiynToTenge(p.b2b_price),
  compare_at_price: tiynToTenge(p.compare_at_price),
  min_price: tiynToTenge(p.min_price),
  purchase_price: tiynToTenge(p.purchase_price),
  b2b_min_order_qty: text(p.b2b_min_order_qty),
  uom: text(p.uom),
  weight: decimalText(p.weight),
  volume: decimalText(p.volume),
  country: text(p.country),
  supplier: text(p.supplier),
  is_active: p.is_active ?? true,
  is_new_arrival: p.is_new_arrival ?? false,
});

/**
 * Тело `POST /admin/products` (или правки с `_method=PUT`). Оба языка и все
 * скалярные поля уходят всегда: пустая строка на сервере становится null,
 * так очищенное в форме поле очищается и в базе.
 */
export function toFormData(values: ProductFormValues, isUpdate: boolean): FormData {
  const data = new FormData();

  for (const field of TRANSLATABLE) {
    for (const locale of LOCALES) {
      data.append(`${field}[${locale}]`, values[field][locale]);
    }
  }

  for (const field of SCALARS) {
    data.append(field, values[field]);
  }

  data.append('is_active', values.is_active ? '1' : '0');
  data.append('is_new_arrival', values.is_new_arrival ? '1' : '0');

  if (isUpdate) {
    // Laravel не разбирает multipart у PUT — метод подменяется полем.
    data.append('_method', 'PUT');
  }

  return data;
}

/** Наценка цены к закупочной в процентах; null — считать не из чего. */
export function markup(price: string, purchase: string): number | null {
  const sell = Number(price);
  const cost = Number(purchase);

  if (price === '' || purchase === '' || !Number.isFinite(sell) || !Number.isFinite(cost) || cost <= 0) {
    return null;
  }

  return Math.round(((sell - cost) / cost) * 100);
}

const byLabel = (a: SelectOption, b: SelectOption) => a.label.localeCompare(b.label, 'ru');

/** Категории с полным путём «Диваны › Прямые» — путь собирается по parent_id. */
export function categoryOptions(categories: NamedOption[]): SelectOption[] {
  const byId = new Map(categories.map((c) => [c.id, c]));

  const path = (category: NamedOption): string => {
    const names: string[] = [];
    const seen = new Set<number>();
    let current: NamedOption | undefined = category;

    // seen — на случай цикла в parent_id: список не должен зависнуть.
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      names.unshift(ru(current.name) || `#${current.id}`);
      current = current.parent_id ? byId.get(current.parent_id) : undefined;
    }

    return names.join(' › ');
  };

  return categories.map((c) => ({ value: String(c.id), label: path(c) })).sort(byLabel);
}

export const brandOptions = (brands: NamedOption[]): SelectOption[] =>
  brands.map((b) => ({ value: String(b.id), label: ru(b.name) || `#${b.id}` })).sort(byLabel);
