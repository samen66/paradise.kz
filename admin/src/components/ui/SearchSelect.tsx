'use client';

import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import { inputClass } from './styles';

export type SelectOption = { value: string; label: string };

type Props = {
  id: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  /** Подпись пустого значения: «Без категории». */
  emptyLabel: string;
  invalid?: boolean;
};

/**
 * Выбор одного значения из списка с поиском по подстроке (combobox).
 *
 * Закрытый показывает выбранное. При фокусе открывается весь список, ввод
 * фильтрует; стрелки, Enter и Escape работают с клавиатуры. Пункт выбирается
 * на mousedown с preventDefault — иначе blur поля закрыл бы список раньше
 * клика.
 */
export default function SearchSelect({ id, options, value, onChange, emptyLabel, invalid }: Props) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const all = useMemo(() => [{ value: '', label: emptyLabel }, ...options], [options, emptyLabel]);
  const selected = all.find((o) => o.value === value) ?? all[0];
  const needle = query.trim().toLocaleLowerCase('ru');
  const visible = needle ? all.filter((o) => o.value !== '' && o.label.toLocaleLowerCase('ru').includes(needle)) : all;

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const pick = (option: SelectOption) => {
    onChange(option.value);
    close();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();

      if (!open) {
        // Список был закрыт — открываем на первом пункте, а не сразу на втором.
        setOpen(true);
        setActive(0);
      } else {
        setActive((i) => Math.min(i + 1, visible.length - 1));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && open && visible[active]) {
      e.preventDefault();
      pick(visible[active]);
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      close();
    }
  };

  return (
    <div className="relative">
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={open && visible[active] ? `${listId}-${active}` : undefined}
        aria-invalid={invalid || undefined}
        autoComplete="off"
        className={`${inputClass} pr-8`}
        value={open ? query : selected.label}
        placeholder={open ? selected.label : undefined}
        onFocus={() => {
          setOpen(true);
          setActive(0);
        }}
        onClick={() => setOpen(true)}
        onBlur={close}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />
      <span aria-hidden className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-zinc-400">⌄</span>
      {open && (
        <ul id={listId} role="listbox" className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
          {visible.length === 0 ? (
            <li className="px-3 py-2 text-sm text-zinc-500">Ничего не найдено</li>
          ) : (
            visible.map((option, index) => (
              <li
                key={option.value || 'empty'}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={option.value === value}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(option);
                }}
                onMouseEnter={() => setActive(index)}
                className={`flex min-h-11 cursor-pointer items-center px-3 text-sm md:min-h-9 ${index === active ? 'bg-zinc-100' : ''} ${
                  option.value === value ? 'font-medium text-blue-700' : 'text-zinc-800'
                }`}
              >
                {option.label}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
