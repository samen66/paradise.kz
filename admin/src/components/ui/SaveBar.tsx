'use client';

import { useEffect } from 'react';
import { buttonGhost, buttonPrimary } from './styles';

type Props = {
  dirty: boolean;
  canSave: boolean;
  saving: boolean;
  /** Ход долгого сохранения: «Загружаем фото 2 из 5». */
  status?: string | null;
  onSave: () => void;
  onReset: () => void;
};

/**
 * Нижняя панель «Отменить / Сохранить».
 *
 * До `lg` — `fixed` над нижней навигацией (BottomNav: h-16 + safe-area), а не
 * поверх неё; странице нужен нижний отступ под панель. С `lg` нижней
 * навигации нет — панель прилипает к низу прокручиваемого `<main>`.
 * `--save-bar-h` поднимает тосты (Toaster) над панелью.
 */
export default function SaveBar({ dirty, canSave, saving, status, onSave, onReset }: Props) {
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--save-bar-h', '4.5rem');

    return () => {
      root.style.removeProperty('--save-bar-h');
    };
  }, []);

  return (
    <div
      role="region"
      aria-label="Сохранение"
      className="fixed inset-x-0 bottom-[calc(4rem_+_env(safe-area-inset-bottom))] z-30 border-t border-zinc-200 bg-white py-2 pl-[calc(1rem_+_env(safe-area-inset-left))] pr-[calc(1rem_+_env(safe-area-inset-right))] shadow-[0_-2px_8px_rgba(0,0,0,0.06)] lg:sticky lg:bottom-0 lg:mt-6 lg:rounded-xl lg:border lg:px-5 lg:py-3"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <p className="min-w-0 truncate text-sm" aria-live="polite">
          {status ? (
            <span className="text-zinc-600">{status}</span>
          ) : dirty ? (
            <span className="text-amber-700">● Есть несохранённые изменения</span>
          ) : null}
        </p>
        <div className="flex shrink-0 gap-2">
          <button type="button" className={buttonGhost} disabled={!dirty || saving} onClick={onReset}>
            Отменить
          </button>
          <button type="button" className={buttonPrimary} disabled={!canSave || saving} onClick={onSave}>
            {saving ? 'Сохраняем…' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}
