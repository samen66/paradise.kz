'use client';

import { useEffect } from 'react';
import { formatTenge } from '@/lib/money';
import { plural } from '@/lib/text';
import { formatQty, type DraftKind } from '@/lib/warehouse';
import ConfirmButton from '@/components/ui/ConfirmButton';
import { buttonGhost, buttonPrimary } from '@/components/ui/styles';

type Props = {
  kind: DraftKind;
  totals: { count: number; units: number; cost: number | null };
  /** Почему нельзя провести; null — можно. */
  blocker: string | null;
  onPost: () => Promise<void>;
  onDelete: () => Promise<void>;
};

const POST_QUESTION: Record<DraftKind, string> = {
  receipt: 'Провести приёмку? Будут созданы партии и движения по складу. Необратимо.',
  write_off: 'Провести списание? Товар уйдёт со склада по FIFO. Необратимо.',
};

/**
 * Итоги и действия черновика. Как SaveBar: до `lg` — над нижней навигацией,
 * с `lg` — прилипает к низу области прокрутки; `--save-bar-h` поднимает тосты.
 */
export default function DocumentFooter({ kind, totals, blocker, onPost, onDelete }: Props) {
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--save-bar-h', '6rem');
    return () => {
      root.style.removeProperty('--save-bar-h');
    };
  }, []);

  const summary = [
    `${totals.count} ${plural(totals.count, ['позиция', 'позиции', 'позиций'])}`,
    `${formatQty(totals.units)} шт`,
    totals.cost !== null ? `Итого ${formatTenge(totals.cost)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      data-testid="document-footer"
      className="fixed inset-x-0 bottom-[calc(4rem_+_env(safe-area-inset-bottom))] z-30 border-t border-zinc-200 bg-white py-2 pl-[calc(1rem_+_env(safe-area-inset-left))] pr-[calc(1rem_+_env(safe-area-inset-right))] shadow-[0_-2px_8px_rgba(0,0,0,0.06)] lg:sticky lg:bottom-0 lg:mt-6 lg:rounded-xl lg:border lg:px-5 lg:py-3"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-zinc-900">{summary}</p>
          {blocker && <p className="text-xs text-amber-700">{blocker}</p>}
        </div>
        <div className="flex shrink-0 gap-2">
          <ConfirmButton className={buttonGhost} question={`Удалить черновик ${kind === 'receipt' ? 'приёмки' : 'списания'}?`} onConfirm={onDelete}>
            Удалить черновик
          </ConfirmButton>
          <ConfirmButton className={buttonPrimary} question={POST_QUESTION[kind]} disabled={blocker !== null} title={blocker ?? undefined} onConfirm={onPost}>
            Провести
          </ConfirmButton>
        </div>
      </div>
    </div>
  );
}
