'use client';

import { useSyncExternalStore } from 'react';
import { DESKTOP_QUERY } from './breakpoints';

const subscribe = (onChange: () => void) => {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener('change', onChange);

  return () => query.removeEventListener('change', onChange);
};

/**
 * `true` с `md` (768px). Для случаев, когда CSS-скрытия мало: DataTable и
 * меню действий рендерят ровно один вариант, иначе в DOM удваивались бы
 * меню и тексты.
 *
 * Серверный снимок — `false` (mobile-first). Расхождения гидрации нет:
 * экраны админки рендерятся на клиенте после ProtectedRoute.
 */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(DESKTOP_QUERY).matches, () => false);
}
