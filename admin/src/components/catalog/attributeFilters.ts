import type { Attribute } from '@/lib/catalogTypes';
import { kk, plural, ru } from '@/lib/text';

/** Чипы экрана «Атрибуты». Атрибутов десятки — фильтрация на клиенте. */
export type AttributeFilter = '' | 'filterable' | 'untranslated' | 'unused';

const FILTERS: AttributeFilter[] = ['', 'filterable', 'untranslated', 'unused'];

export const parseAttributeFilter = (value: string | null): AttributeFilter =>
  FILTERS.includes(value as AttributeFilter) ? (value as AttributeFilter) : '';

/** Сколько раз атрибут стоит у товаров и вариантов. */
export const usage = (a: Attribute): number => (a.values_count ?? 0) + (a.variant_values_count ?? 0);

export function matchesAttribute(a: Attribute, filter: AttributeFilter, search: string): boolean {
  if (filter === 'filterable' && !a.is_filterable) {
    return false;
  }
  if (filter === 'untranslated' && kk(a.name).trim() !== '') {
    return false;
  }
  if (filter === 'unused' && usage(a) > 0) {
    return false;
  }

  const needle = search.trim().toLocaleLowerCase('ru');

  return needle === '' || [ru(a.name), kk(a.name), a.slug].some((text) => text.toLocaleLowerCase('ru').includes(needle));
}

/** «в 12 товарах · 3 вариантах» или «не используется». */
export function usageText(a: Attribute): string {
  const products = a.values_count ?? 0;
  const variants = a.variant_values_count ?? 0;
  const parts = [
    products > 0 ? `${products} ${plural(products, ['товаре', 'товарах', 'товарах'])}` : null,
    variants > 0 ? `${variants} ${plural(variants, ['варианте', 'вариантах', 'вариантах'])}` : null,
  ].filter(Boolean);

  return parts.length === 0 ? 'не используется' : `в ${parts.join(' · ')}`;
}
