export type Translatable = string | { ru?: string; kk?: string } | null | undefined;

/** The Russian text of a translatable column, whichever shape the API sent. */
export const ru = (value: Translatable): string => (typeof value === 'string' ? value : value?.ru ?? '');

/** Казахский текст переводимой колонки; '' — перевода нет. */
export const kk = (value: Translatable): string => (typeof value === 'string' ? '' : value?.kk ?? '');

export type ProductRef = { id: number; name: Translatable; code: string | null; article: string | null; thumb_url?: string | null };

export const productLabel = (p: ProductRef): string =>
  [ru(p.name) || `#${p.id}`, p.article || p.code].filter(Boolean).join(' · ');

export type ClientRef = { id: number; company_name: string | null; name: string | null; email: string | null; phone: string | null; is_approved?: boolean };

export const clientLabel = (c: ClientRef): string =>
  [c.company_name || `Клиент #${c.id}`, c.phone || c.email].filter(Boolean).join(' · ');

/**
 * Количество без хвостовых нулей: API отдаёт `order_items.quantity` как
 * decimal:3, и «5.000» читается как пять тысяч.
 */
export const formatQuantity = (value: unknown): string =>
  Number(value).toLocaleString('ru-RU', { maximumFractionDigits: 3 });

/** Русское склонение по числу: plural(5, ['позиция', 'позиции', 'позиций']) → «позиций». */
export const plural = (count: number, [one, few, many]: [string, string, string]): string => {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (!Number.isInteger(count)) {
    return few;
  }
  if (mod10 === 1 && mod100 !== 11) {
    return one;
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return few;
  }

  return many;
};
