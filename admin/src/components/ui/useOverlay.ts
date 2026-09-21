'use client';

import { useEffect } from 'react';

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
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
}
