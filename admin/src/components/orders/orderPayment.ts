/**
 * Оплата заказа: подписи способа и статуса.
 *
 * Коды приходят с бэка как есть (`orders.payment_method`, `orders.payment_status`).
 * Набор повторяет storefront (`order.paymentMethod` / `order.paymentStatus` в
 * messages/ru.json). Незнакомый код показываем как есть, чтобы новое значение
 * было видно, а не пропадало.
 */

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Наличными при получении',
  kaspi: 'Kaspi QR / Kaspi Pay',
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: 'Не оплачен',
  paid: 'Оплачен',
  cancelled: 'Оплата отменена',
  failed: 'Оплата не прошла',
};

export function paymentMethodLabel(method: string): string {
  return PAYMENT_METHOD_LABELS[method] ?? method;
}

export function paymentStatusLabel(status: string): string {
  return PAYMENT_STATUS_LABELS[status] ?? status;
}
