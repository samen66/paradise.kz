'use client';

import Modal from './Modal';
import { buttonSecondary } from './styles';

export type SheetAction = {
  key: string;
  label: string;
  /** Красным: действие необратимо или что-то отменяет. */
  destructive?: boolean;
  onSelect: () => void;
};

type Props = { title: string; actions: SheetAction[]; onClose: () => void };

/**
 * Меню действий шторкой снизу — замена выпадашки «⋯» на телефоне.
 * Пункты во всю ширину и высотой 48 px: до них дотягивается большой палец.
 *
 * Закрытие шторки запрашивается раньше действия, но `onClose` лишь ставит
 * в очередь обновление состояния — оно не успевает отрисоваться синхронно.
 * Поэтому синхронный `window.confirm` (отмена заказа) на деле всплывает
 * над ещё отрисованной шторкой, а она размонтируется сразу после закрытия
 * диалога. Безвредно: `window.confirm` модальный и блокирует ввод сам.
 */
export default function ActionSheet({ title, actions, onClose }: Props) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <button type="button" onClick={onClose} className={`${buttonSecondary} w-full`}>
          Закрыть
        </button>
      }
    >
      <ul className="-mx-4 divide-y divide-zinc-100 border-y border-zinc-100 md:-mx-6">
        {actions.map((action) => (
          <li key={action.key}>
            <button
              type="button"
              onClick={() => {
                onClose();
                action.onSelect();
              }}
              className={`flex min-h-12 w-full items-center px-4 text-left text-base active:bg-zinc-100 md:px-6 ${
                action.destructive ? 'text-red-600' : 'text-zinc-800'
              }`}
            >
              {action.label}
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
