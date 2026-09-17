export type Translatable = string | { ru?: string; kk?: string } | null | undefined;

/** The Russian text of a translatable column, whichever shape the API sent. */
export const ru = (value: Translatable): string => (typeof value === 'string' ? value : value?.ru ?? '');

export type ProductRef = { id: number; name: Translatable; code: string | null; article: string | null };

export const productLabel = (p: ProductRef): string =>
  [ru(p.name) || `#${p.id}`, p.article || p.code].filter(Boolean).join(' · ');

export type ClientRef = { id: number; company_name: string | null; email: string | null; phone: string | null };

export const clientLabel = (c: ClientRef): string =>
  [c.company_name || `Клиент #${c.id}`, c.phone || c.email].filter(Boolean).join(' · ');
