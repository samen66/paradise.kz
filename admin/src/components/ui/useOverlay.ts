'use client';

import { useEffect } from 'react';

// Счётчик и исходное значение живут на модуле, а не в хуке: с двумя
// вложенными слоями (например, ActionSheet поверх Modal) React размонтирует
// их в произвольном порядке, и «свой» previousOverflow каждого инстанса не
// знает, что снаружи ещё остался открытый слой. Счётчик восстанавливает
// overflow только когда закрылся последний слой, а не первый по очереди.
let lockCount = 0;
let previousOverflow = '';

/**
 * Общее поведение всплывающих слоёв — модалки, шторки, меню «Ещё»:
 * Escape закрывает слой, а страница под ним не прокручивается.
 *
 * На телефоне прокручивается сам документ (см. shell/AppShell), и без
 * блокировки палец, долиставший шторку до конца, начинал бы листать
 * список под ней.
 */
export function useOverlay(onClose: () => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);

    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (lockCount++ === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }

    return () => {
      if (--lockCount === 0) {
        document.body.style.overflow = previousOverflow;
      }
    };
  }, []);
}
