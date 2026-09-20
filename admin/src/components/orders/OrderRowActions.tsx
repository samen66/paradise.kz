'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { allowedTransitions, isDestructive, statusLabel, type OrderStatus } from './orderStatus';

type Props = {
  orderId: number;
  status: OrderStatus;
  onChanged: () => void;
};

/** Примерная высота меню: пунктов немного, а сама высота нужна только чтобы решить, открывать вверх или вниз. */
const MENU_HEIGHT_ESTIMATE = 220;

/**
 * Действия над заказом прямо из строки списка.
 *
 * Показываются только допустимые переходы — те же, что разрешает
 * Order::ALLOWED_TRANSITIONS на бэке. Отмена спрашивает подтверждение: она не
 * просто пишет статус, а возвращает товар на склад через
 * OrderCancellationService, и отменить это нечем.
 *
 * Меню позиционируется `position: fixed` от координат кнопки-триггера, а не
 * `absolute` внутри строки: DataTable даёт таблице `overflow-hidden` ради
 * скруглённых углов, и `absolute`-меню на нижних строках обрезало бы этим же
 * краем.
 */
export default function OrderRowActions({ orderId, status, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top?: number; bottom?: number; right: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const transitions = allowedTransitions(status);

  const openMenu = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUpward = spaceBelow < MENU_HEIGHT_ESTIMATE;

      setMenuPosition({
        right: window.innerWidth - rect.right,
        ...(openUpward ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
      });
    }
    setOpen((v) => !v);
  };

  const move = async (next: OrderStatus) => {
    if (isDestructive(next) && !window.confirm('Отменить заказ? Товар вернётся на склад, отменить это будет нельзя.')) {
      return;
    }

    setOpen(false);
    setBusy(true);

    try {
      await api.patch(`/admin/orders/${orderId}`, { status: next });
      toast.success(`Статус изменён: ${statusLabel(next)}`);
      onChanged();
    } catch {
      // 401/403/5xx показывает перехватчик в lib/api; здесь остаётся 422 —
      // переход, который бэк считает недопустимым.
      toast.error('Не удалось изменить статус');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center justify-end gap-1">
      <Link href={`/orders/${orderId}`} className="rounded-md px-2 py-1 text-sm text-blue-600 hover:bg-blue-50">
        Открыть
      </Link>

      {transitions.length > 0 && (
        <div className="relative">
          <button
            ref={triggerRef}
            type="button"
            disabled={busy}
            aria-label="Действия"
            aria-expanded={open}
            onClick={openMenu}
            className="rounded-md px-2 py-1 text-zinc-500 hover:bg-zinc-100 disabled:opacity-50"
          >
            ⋯
          </button>

          {open && menuPosition && (
            <>
              {/* Клик мимо меню закрывает его. */}
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
              <div
                style={{ position: 'fixed', ...menuPosition }}
                className="z-20 min-w-48 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-lg"
              >
                {transitions.map((next) => (
                  <button
                    key={next}
                    type="button"
                    onClick={() => move(next)}
                    className={`block w-full px-4 py-2 text-left text-sm hover:bg-zinc-50 ${
                      isDestructive(next) ? 'text-red-600' : 'text-zinc-700'
                    }`}
                  >
                    {statusLabel(next)}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
