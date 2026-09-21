'use client';

import { useState } from 'react';
import api from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { buttonPrimary, cardClass } from '@/components/ui/styles';
import {
  actionLabel,
  allowedTransitions,
  isDestructive,
  primaryTransition,
  statusLabel,
  STATUS_FLOW,
  type OrderStatus,
} from './orderStatus';

type Props = {
  orderId: number;
  status: OrderStatus;
  onChanged: (order: any) => void;
};

/**
 * Где заказ сейчас и что с ним сделать дальше.
 *
 * Шкала показывает рабочий путь, под ней — одна основная кнопка следующего
 * шага и второстепенные переходы текстом. Переходы берутся из той же матрицы,
 * что и меню в списке (Order::ALLOWED_TRANSITIONS на бэке); отмена, как и там,
 * спрашивает подтверждение — она возвращает товар на склад.
 */
export default function OrderStatusCard({ orderId, status, onChanged }: Props) {
  const [busyWith, setBusyWith] = useState<OrderStatus | null>(null);

  const primary = primaryTransition(status);
  const secondary = allowedTransitions(status).filter((s) => s !== primary);

  const move = async (next: OrderStatus) => {
    if (isDestructive(next) && !window.confirm('Отменить заказ? Товар вернётся на склад, отменить это будет нельзя.')) {
      return;
    }

    setBusyWith(next);

    try {
      const res = await api.patch(`/admin/orders/${orderId}`, { status: next });
      onChanged(res.data.data);
      toast.success(`Статус изменён: ${statusLabel(next)}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Не удалось изменить статус');
    } finally {
      setBusyWith(null);
    }
  };

  return (
    <section aria-label="Статус заказа" data-status={status} className={`${cardClass} p-6`}>
      <h2 className="text-base font-semibold text-zinc-900 mb-5">Статус заказа</h2>

      {status === 'cancelled' ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-semibold">Заказ отменён</p>
          <p className="mt-0.5">Товар возвращён на склад. Статус финальный, изменить его нельзя.</p>
        </div>
      ) : (
        <StatusSteps status={status} />
      )}

      {(status === 'synced' || status === 'failed') && (
        <p className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
          Архивный заказ из прежней учётной системы ({statusLabel(status)}). Переведите его в рабочий статус.
        </p>
      )}

      {status === 'completed' && (
        <p className="mt-4 text-sm text-emerald-700 font-medium">Заказ завершён. Статус финальный, изменить его нельзя.</p>
      )}

      {(primary || secondary.length > 0) && (
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
          {primary && (
            <button
              type="button"
              onClick={() => move(primary)}
              disabled={busyWith !== null}
              className={`${buttonPrimary} h-11 px-6 text-base`}
            >
              {busyWith === primary && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-r-transparent mr-2" />
              )}
              {actionLabel(status, primary)}
            </button>
          )}

          {secondary.map((next) => (
            <button
              key={next}
              type="button"
              onClick={() => move(next)}
              disabled={busyWith !== null}
              className={`text-sm font-medium disabled:opacity-50 ${
                isDestructive(next) ? 'text-red-600 hover:text-red-800' : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              {busyWith === next ? 'Сохранение…' : actionLabel(status, next)}
            </button>
          ))}

          <p className="text-xs text-zinc-500 sm:ml-auto">Клиент получит уведомление в WhatsApp.</p>
        </div>
      )}
    </section>
  );
}

/**
 * Шкала рабочего пути: пройденные шаги — зелёные с галочкой, текущий — синий,
 * будущие — серые. Архивные synced/failed на шкале не стоят, поэтому для них
 * все шаги серые.
 */
function StatusSteps({ status }: { status: OrderStatus }) {
  const currentIndex = STATUS_FLOW.indexOf(status);
  const isFinished = status === 'completed';

  return (
    <ol className="flex items-start">
      {STATUS_FLOW.map((step, index) => {
        const isDone = index < currentIndex || (isFinished && index === currentIndex);
        const isCurrent = index === currentIndex && !isFinished;
        const isLast = index === STATUS_FLOW.length - 1;

        return (
          <li
            key={step}
            aria-current={index === currentIndex ? 'step' : undefined}
            className="relative flex-1 flex flex-col items-center text-center"
          >
            {!isLast && (
              <span
                aria-hidden
                className={`absolute top-4 left-1/2 w-full h-0.5 ${index < currentIndex ? 'bg-emerald-500' : 'bg-zinc-200'}`}
              />
            )}
            <span
              className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-semibold ${
                isDone
                  ? 'border-emerald-500 bg-emerald-500 text-white'
                  : isCurrent
                    ? 'border-blue-600 bg-blue-600 text-white ring-4 ring-blue-100'
                    : 'border-zinc-300 bg-white text-zinc-400'
              }`}
            >
              {isDone ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              ) : (
                index + 1
              )}
            </span>
            <span
              className={`mt-2 px-1 text-xs sm:text-sm ${
                isCurrent ? 'font-semibold text-blue-700' : isDone ? 'font-medium text-zinc-900' : 'text-zinc-500'
              }`}
            >
              {statusLabel(step)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
