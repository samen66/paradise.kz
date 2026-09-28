import type { Translatable } from './text';

/** Атрибут из `/admin/attributes`: название на двух языках и сколько раз он используется. */
export type Attribute = {
  id: number;
  name: Translatable;
  slug: string;
  is_filterable: boolean;
  values_count?: number;
  variant_values_count?: number;
};

export type PriceType = { id: number; code: string; name: string; sort_order: number };
