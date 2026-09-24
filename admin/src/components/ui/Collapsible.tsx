'use client';

import type { ReactNode } from 'react';
import { cardClass } from './styles';

type Props = {
  id: string;
  title: string;
  /** Справа в заголовке: «2 цены», «нет», «заполнено». */
  summary?: ReactNode;
  /** Под заголовком мелко: «Сохраняется сразу». */
  note?: string;
  open: boolean;
  onToggle: (open: boolean) => void;
  /** Блок заблокирован (товар ещё не сохранён): видна причина, содержимого нет. */
  disabledHint?: string;
  /** Без своей карточки — для блока внутри другой карточки. */
  plain?: boolean;
  children: ReactNode;
};

/**
 * Сворачиваемый блок. Содержимое свёрнутого остаётся в DOM (`hidden`): поля
 * в нём по-прежнему в форме, а списки внутри успевают загрузиться и отдать
 * счётчик для заголовка. `scroll-mt-*` — чтобы при переходе к блоку его не
 * закрывала липкая шапка.
 */
export default function Collapsible({ id, title, summary, note, open, onToggle, disabledHint, plain, children }: Props) {
  const panelId = `${id}-panel`;
  const locked = disabledHint !== undefined;
  const expanded = open && !locked;

  return (
    <section id={id} className={`scroll-mt-36 lg:scroll-mt-4 ${plain ? 'rounded-lg border border-dashed border-zinc-300' : cardClass}`}>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        disabled={locked}
        onClick={() => onToggle(!open)}
        className="flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left disabled:cursor-not-allowed md:px-5"
      >
        <span aria-hidden className={`text-zinc-400 transition-transform ${expanded ? 'rotate-90' : ''}`}>▸</span>
        <span className="min-w-0 flex-1">
          <span className={`block text-sm font-semibold ${locked ? 'text-zinc-400' : 'text-zinc-900'}`}>{title}</span>
          {(locked ? disabledHint : note) && <span className="block text-xs text-zinc-500">{locked ? disabledHint : note}</span>}
        </span>
        {!locked && summary && <span className="shrink-0 text-xs text-zinc-500">{summary}</span>}
      </button>
      {!locked && (
        <div id={panelId} hidden={!open} className="border-t border-zinc-100 px-4 py-4 md:px-5">
          {children}
        </div>
      )}
    </section>
  );
}
