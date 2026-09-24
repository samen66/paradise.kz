'use client';

import { useEffect } from 'react';

export const UNSAVED_QUESTION = 'Уйти без сохранения? Изменения пропадут.';

/**
 * Пока `active`, спрашивает перед уходом со страницы.
 *
 * Закрытие и перезагрузку вкладки ловит `beforeunload`. Переходы внутри
 * приложения — клик по `<a>` того же origin: в App Router нет события
 * «перед переходом», поэтому клик перехватывается в фазе захвата на
 * document, раньше обработчика next/link. Кнопку браузера «Назад» так не
 * остановить — это известное ограничение.
 */
export function useUnsavedGuard(active: boolean, message: string = UNSAVED_QUESTION): void {
  useEffect(() => {
    if (!active) {
      return;
    }

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Старые браузеры показывают вопрос, только если returnValue задан.
      e.returnValue = '';
    };

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }

      const link = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;

      if (!link || link.target === '_blank' || link.hasAttribute('download')) {
        return;
      }

      const url = new URL(link.href, window.location.href);

      if (url.origin !== window.location.origin || (url.pathname === window.location.pathname && url.search === window.location.search)) {
        return;
      }

      if (!window.confirm(message)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClick, true);

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [active, message]);
}
