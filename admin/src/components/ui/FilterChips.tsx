'use client';

export type ChipOption = { value: string; label: string; count?: number | null };

type Props = { label: string; options: ChipOption[]; value: string; onChange: (value: string) => void };

/**
 * Один выбор из нескольких чипов со счётчиками. На телефоне ряд листается
 * вбок одной строкой.
 */
export default function FilterChips({ label, options, value, onChange }: Props) {
  return (
    <div role="radiogroup" aria-label={label} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
      {options.map((option) => {
        const checked = option.value === value;

        return (
          <button
            key={option.value || 'all'}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => onChange(option.value)}
            className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-sm font-medium transition-colors md:min-h-9 ${
              checked ? 'bg-blue-600 text-white' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
            }`}
          >
            {option.label}
            {option.count !== undefined && option.count !== null && (
              <span className={checked ? 'text-white/80' : 'text-zinc-500'}>{option.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
