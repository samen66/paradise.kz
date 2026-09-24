'use client';

type Props = { sections: { id: string; label: string }[]; onJump: (id: string) => void };

/**
 * Полоса быстрых переходов по разделам длинной формы. Только до `lg`: на
 * широком экране разделы и так видны в две колонки. Одна строка, листается
 * вбок, как вкладки.
 */
export default function SectionNav({ sections, onJump }: Props) {
  return (
    <nav aria-label="Разделы" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pt-1 lg:hidden">
      {sections.map((section) => (
        <button
          key={section.id}
          type="button"
          onClick={() => onJump(section.id)}
          className="min-h-11 shrink-0 whitespace-nowrap rounded-full border border-zinc-300 bg-white px-4 text-sm text-zinc-700 active:bg-zinc-100"
        >
          {section.label}
        </button>
      ))}
    </nav>
  );
}
