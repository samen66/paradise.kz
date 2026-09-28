'use client';

import { useEffect, useId, useState, type KeyboardEvent, type ReactNode } from 'react';
import api from '@/lib/api';
import { inputClass } from './styles';

type Props<T extends { id: number }> = {
  searchPath: string;
  label: (item: T) => string;
  onPick: (item: T) => unknown;
  placeholder: string;
  excludeIds?: number[];
  /** Вторая строка пункта: имя, телефон, метка. */
  description?: (item: T) => ReactNode;
  /** `sort` Spatie Query Builder — порядок и без ввода, и с ним. */
  sort?: string;
  /** Когда всё найденное исключено через excludeIds. */
  allExcludedText?: string;
};

/**
 * Выбор записи из админского списка с `filter[search]`. При фокусе сразу
 * показывает первую страницу списка, ввод фильтрует (с паузой 300 мс);
 * стрелки, Enter и Escape — с клавиатуры. Пункт выбирается на mousedown с
 * preventDefault — иначе blur поля закрыл бы список раньше клика.
 */
export default function EntityPicker<T extends { id: number }>({
  searchPath,
  label,
  onPick,
  placeholder,
  excludeIds = [],
  description,
  sort,
  allExcludedText = 'Все уже выбраны',
}: Props<T>) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    const term = query.trim();

    const timer = setTimeout(async () => {
      setLoading(true);

      try {
        const res = await api.get(searchPath, { params: { ...(sort ? { sort } : {}), ...(term ? { 'filter[search]': term } : {}) } });

        if (!cancelled) {
          setResults((res.data?.data ?? res.data ?? []) as T[]);
          setActive(0);
        }
      } catch {
        if (!cancelled) {
          setResults([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, term ? 300 : 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, query, searchPath, sort]);

  const visible = results.filter((r) => !excludeIds.includes(r.id));

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const pick = async (item: T) => {
    close();
    await onPick(item);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, Math.max(visible.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && open && visible[active]) {
      e.preventDefault();
      void pick(visible[active]);
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      close();
    }
  };

  const status = loading && results.length === 0
    ? 'Загрузка…'
    : visible.length === 0
      ? results.length > 0 ? allExcludedText : 'Ничего не найдено'
      : null;

  return (
    <div className="relative">
      <input
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={open && visible[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        className={inputClass}
        placeholder={placeholder}
        aria-label={placeholder}
        value={query}
        onFocus={() => setOpen(true)}
        onBlur={close}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />
      {open && (
        <ul id={listId} role="listbox" className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
          {status ? (
            <li className="px-3 py-2 text-sm text-zinc-500">{status}</li>
          ) : (
            visible.map((item, index) => (
              <li
                key={item.id}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  void pick(item);
                }}
                onMouseEnter={() => setActive(index)}
                className={`flex min-h-11 cursor-pointer flex-col justify-center px-3 py-1.5 text-sm md:min-h-9 ${index === active ? 'bg-zinc-100' : ''}`}
              >
                <span className="text-zinc-900">{label(item)}</span>
                {description && <span className="text-xs text-zinc-500">{description(item)}</span>}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
