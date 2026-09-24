import type { ProductRef, Translatable } from '@/lib/text';

export type Ref = { id: number; name: string };

export type Store = {
  id: number;
  name: string;
  code: string | null;
  type: 'warehouse' | 'retail_point';
  address: string | null;
  is_active: boolean;
  is_default: boolean;
};

export const STORE_TYPES: Record<Store['type'], string> = {
  warehouse: 'Склад',
  retail_point: 'Точка выдачи / шоурум',
};

export type Supplier = {
  id: number;
  name: string;
  bin: string | null;
  phone: string | null;
  email: string | null;
  note: string | null;
  is_active: boolean;
};

export type DocumentStatus = 'draft' | 'posted';

export type GoodsReceiptListItem = {
  id: number;
  number: string | null;
  status: DocumentStatus;
  received_at: string | null;
  posted_at: string | null;
  store: Ref;
  supplier: Ref | null;
  items_count: number;
  total_cost: number;
};

export type GoodsReceiptItem = {
  id: number;
  product_id: number;
  quantity: string;
  unit_cost: number;
  product: ProductRef;
};

export type GoodsReceipt = {
  id: number;
  number: string | null;
  status: DocumentStatus;
  received_at: string | null;
  posted_at: string | null;
  note: string | null;
  store_id: number;
  supplier_id: number | null;
  store: Ref;
  supplier: Ref | null;
  user: Ref | null;
  items: GoodsReceiptItem[];
  total_cost: number;
};

export type WriteOffReason = 'damaged' | 'lost' | 'regrading' | 'other';

export const WRITE_OFF_REASONS: Record<WriteOffReason, string> = {
  damaged: 'Брак / повреждение',
  lost: 'Потеря / недостача',
  regrading: 'Пересортица',
  other: 'Прочее',
};

export type WriteOffListItem = {
  id: number;
  reason: WriteOffReason;
  status: DocumentStatus;
  posted_at: string | null;
  created_at: string;
  store: Ref;
  items_count: number;
};

export type WriteOffItem = {
  id: number;
  product_id: number;
  quantity: string;
  product: ProductRef;
  available?: number;
};

export type WriteOff = {
  id: number;
  label: string;
  reason: WriteOffReason;
  note: string | null;
  status: DocumentStatus;
  posted_at: string | null;
  store_id: number;
  store: Ref;
  user: Ref | null;
  items: WriteOffItem[];
  total_cost: number | null;
};

export type MovementType =
  | 'receipt'
  | 'sale'
  | 'return'
  | 'transfer_in'
  | 'transfer_out'
  | 'write_off'
  | 'adjustment'
  | 'stocktake';

export const MOVEMENT_TYPES: Record<MovementType, string> = {
  receipt: 'Приход',
  sale: 'Продажа',
  return: 'Возврат',
  transfer_in: 'Перемещение (приход)',
  transfer_out: 'Перемещение (расход)',
  write_off: 'Списание',
  adjustment: 'Корректировка',
  stocktake: 'Инвентаризация',
};

export type StockMovement = {
  id: number;
  created_at: string;
  type: MovementType;
  qty_delta: number;
  unit_cost: number | null;
  balance_after: number | null;
  note: string | null;
  store: Ref;
  product: { id: number; name: Translatable; code: string | null };
  user: Ref | null;
  document: { type: 'receipt' | 'write_off' | 'order'; id: number; label: string } | null;
};

/** Quantity typed into a form: digits, up to three decimals. */
export const QUANTITY_PATTERN = /^\d+(\.\d{1,3})?$/;

export const formatQty = (value: number | string | null | undefined): string =>
  value === null || value === undefined || value === ''
    ? '—'
    : Number(value).toLocaleString('ru-RU', { maximumFractionDigits: 3 });

/**
 * Line cost in тиын (quantity × unit cost), rounded half-up — mirrors
 * `GoodsReceiptItem::lineCost()` on the server (thousandths split on the
 * integer milli-quantity) so the displayed per-line and total sums agree
 * with what posting computes, without the float drift a plain
 * `Math.round(Number(quantity) * unitCost)` can produce.
 */
export const lineCost = (quantity: string, unitCost: number): number => {
  const milli = Math.round(Number(quantity) * 1000);
  const whole = Math.trunc(milli / 1000);
  const thousandths = milli % 1000;

  return whole * unitCost + Math.trunc((thousandths * unitCost + 500) / 1000);
};

export const formatDateTime = (value: string | null | undefined): string =>
  value ? new Date(value).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }) : '—';

/**
 * Turns a `YYYY-MM-DD` from a `<input type="date">` filter into the start
 * (or end) of that day as an ISO instant in the browser's own timezone —
 * the manager's local day — so the API's exact-instant parsing (as opposed
 * to its own app-timezone day rounding for a bare date) lines up with what
 * the manager actually meant by "17.09", regardless of the server's UTC.
 */
export const dayBoundary = (date: string, end: boolean): string =>
  new Date(`${date}T${end ? '23:59:59.999' : '00:00:00'}`).toISOString();

export type DocumentKind = 'receipts' | 'write_offs';

/** Неизвестное значение (ручной ввод, старая ссылка) — приёмки, а не пустой экран. */
export const parseDocumentKind = (value: string | null): DocumentKind =>
  value === 'write_offs' ? 'write_offs' : 'receipts';

/** Адреса раздела «Склад». Все ссылки на склад в админке строятся отсюда. */
export const warehouseHref = {
  overview: '/warehouse',
  stock: '/warehouse/stock',
  movements: '/warehouse/movements',
  documents: (kind: DocumentKind = 'receipts') => `/warehouse/documents?kind=${kind}`,
  receipt: (id: number) => `/warehouse/receipts/${id}`,
  writeOff: (id: number) => `/warehouse/write-offs/${id}`,
  stores: '/warehouse/stores',
  suppliers: '/warehouse/suppliers',
} as const;

export type StockSummary = {
  total_value: number;
  low: number;
  out: number;
  drafts: { receipts: number; write_offs: number };
  recent_movements: StockMovement[];
  has_active_store: boolean;
};

export const documentHref = (document: NonNullable<StockMovement['document']>): string =>
  document.type === 'receipt'
    ? warehouseHref.receipt(document.id)
    : document.type === 'write_off'
      ? warehouseHref.writeOff(document.id)
      : `/orders/${document.id}`;
