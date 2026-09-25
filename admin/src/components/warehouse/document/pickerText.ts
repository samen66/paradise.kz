import { formatTenge } from '@/lib/money';
import { formatQty, type DraftKind, type PickerProduct } from '@/lib/warehouse';

/** «ART-1 · ост. 3 · 1 500 ₸» — у списания без цены. */
export const pickerMeta = (product: PickerProduct, kind: DraftKind): string =>
  [
    product.article || product.code,
    `ост. ${formatQty(product.on_hand)}`,
    kind === 'receipt' ? formatTenge(product.suggested_unit_cost) : null,
  ]
    .filter(Boolean)
    .join(' · ');
