'use client';

import { useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useOverlay } from './useOverlay';

type ModalProps = { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode };

/**
 * Диалог. На телефоне — шторка снизу во всю ширину, с `md` — окно по центру.
 *
 * `footer` рисуется вне прокручиваемой области: кнопки остаются на виду,
 * сколько бы полей ни было в форме. Кнопка отправки в футере связывается с
 * формой атрибутом `form`, а не вложенностью (см. CrudModal).
 *
 * Рисуется порталом в `document.body`: липкая шапка экрана (`PageHeader`,
 * `sticky z-30`) — свой контекст наложения, и модалка, открытая кнопкой из
 * шапки, иначе оказалась бы под нижней панелью (`z-40`).
 */
export default function Modal({ title, onClose, children, footer }: ModalProps) {
  const titleId = useId();
  useOverlay(onClose);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 md:items-center md:p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[90dvh] w-full flex-col rounded-t-2xl bg-white shadow-xl md:max-w-lg md:rounded-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="shrink-0 px-4 pt-5 pb-3 text-lg font-semibold text-zinc-900 md:px-6 md:pt-6 md:pb-4">
          {title}
        </h2>
        <div
          className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 md:px-6 ${
            footer ? 'pb-4' : 'pb-[calc(1.25rem_+_env(safe-area-inset-bottom))] md:pb-6'
          }`}
        >
          {children}
        </div>
        {footer && (
          <div className="shrink-0 border-t border-zinc-100 px-4 pt-3 pb-[calc(0.75rem_+_env(safe-area-inset-bottom))] md:border-t-0 md:px-6 md:pt-0 md:pb-6">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
