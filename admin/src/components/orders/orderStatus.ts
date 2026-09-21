/**
 * Статусы заказа: подписи, цвета, допустимые переходы.
 *
 * Единственное место, где это знание живёт на фронте. Матрица переходов
 * повторяет Order::ALLOWED_TRANSITIONS на бэке — дублирование сознательное:
 * здесь она рисует меню, там защищает данные, и каждая сторона должна быть
 * права сама по себе.
 */

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'in_delivery'
  | 'completed'
  | 'cancelled'
  | 'synced'
  | 'failed';

export type OrderSegment = 'all' | 'b2b' | 'retail';

/**
 * Ключ вкладки. Перечислен явно, а не выведен из OrderStatus: `synced` и
 * `failed` вкладок не имеют — они спрятаны за одной «Архив», и API счётчик по
 * ним отдельно не отдаёт. Вывести тип из OrderStatus значило бы пообещать
 * counts.synced, которого в ответе нет.
 */
export type StatusTabKey =
  | 'all'
  | 'pending'
  | 'confirmed'
  | 'in_delivery'
  | 'completed'
  | 'cancelled'
  | 'archived';

export type StatusCounts = Record<StatusTabKey, number>;

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Новый',
  confirmed: 'Подтверждён',
  in_delivery: 'В доставке',
  completed: 'Завершён',
  cancelled: 'Отменён',
  synced: 'Архив (отправлен)',
  failed: 'Архив (ошибка отправки)',
};

export const STATUS_BADGE: Record<OrderStatus, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  confirmed: 'bg-blue-50 text-blue-700 border-blue-200',
  in_delivery: 'bg-violet-50 text-violet-700 border-violet-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
  synced: 'bg-zinc-100 text-zinc-600 border-zinc-200',
  failed: 'bg-zinc-100 text-zinc-600 border-zinc-200',
};

export const SEGMENT_TABS: { key: OrderSegment; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'b2b', label: 'B2B' },
  { key: 'retail', label: 'Розница' },
];

export const STATUS_TABS: { key: StatusTabKey; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'pending', label: 'Новые' },
  { key: 'confirmed', label: 'Подтверждённые' },
  { key: 'in_delivery', label: 'В доставке' },
  { key: 'completed', label: 'Завершённые' },
  { key: 'cancelled', label: 'Отменённые' },
  { key: 'archived', label: 'Архив' },
];

/**
 * Отмена стоит только у «нового» и «подтверждённого» — ровно там, где её
 * пускает OrderCancellationService на бэке. Предлагать её у «в доставке»
 * значило бы рисовать заведомо падающий пункт меню.
 *
 * «В доставке» умеет вернуться в «подтверждён»: это единственный путь к
 * отмене уехавшего заказа.
 */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['in_delivery', 'cancelled'],
  in_delivery: ['completed', 'confirmed'],
  completed: [],
  cancelled: [],
  synced: ['confirmed', 'in_delivery', 'completed'],
  failed: ['confirmed', 'in_delivery', 'completed'],
};

export function allowedTransitions(from: OrderStatus): OrderStatus[] {
  return TRANSITIONS[from] ?? [];
}

/** Требует подтверждения: отмена возвращает товар на склад. */
export function isDestructive(status: OrderStatus): boolean {
  return status === 'cancelled';
}

export function statusLabel(status: string): string {
  return STATUS_LABELS[status as OrderStatus] ?? status;
}

export function statusBadge(status: string): string {
  return STATUS_BADGE[status as OrderStatus] ?? 'bg-zinc-100 text-zinc-600 border-zinc-200';
}

/** Рабочий путь заказа — шаги шкалы на карточке. */
export const STATUS_FLOW: OrderStatus[] = ['pending', 'confirmed', 'in_delivery', 'completed'];

const ACTION_LABELS: Partial<Record<OrderStatus, string>> = {
  confirmed: 'Подтвердить заказ',
  in_delivery: 'Передать в доставку',
  completed: 'Завершить заказ',
  cancelled: 'Отменить заказ',
};

/**
 * Подпись кнопки перехода — глагол, а не название статуса: менеджер нажимает
 * «Подтвердить заказ», а не «Подтверждён». Шаг назад из доставки называется
 * отдельно, чтобы не выглядеть повторным подтверждением.
 */
export function actionLabel(from: OrderStatus, to: OrderStatus): string {
  if (from === 'in_delivery' && to === 'confirmed') {
    return 'Вернуть в подтверждённые';
  }

  return ACTION_LABELS[to] ?? statusLabel(to);
}

/**
 * Основное действие — первый неразрушительный переход из матрицы: она
 * перечисляет шаг вперёд первым. Остальные переходы идут второстепенными.
 */
export function primaryTransition(from: OrderStatus): OrderStatus | null {
  return allowedTransitions(from).find((s) => !isDestructive(s)) ?? null;
}
