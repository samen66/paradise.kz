'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { inputClass } from './styles';

type Props<T extends { id: number }> = {
  searchPath: string;
  label: (item: T) => string;
  onPick: (item: T) => unknown;
  placeholder: string;
  excludeIds?: number[];
};

/** Search-as-you-type over an admin list endpoint that supports filter[search]. */
export default function EntityPicker<T extends { id: number }>({ searchPath, label, onPick, placeholder, excludeIds = [] }: Props<T>) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<T[]>([]);

  useEffect(() => {
    if (query.trim().length < 2) {
      // Clearing results when the query is too short to search on.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);

      return;
    }

    let cancelled = false;

    const timer = setTimeout(async () => {
      try {
        const res = await api.get(searchPath, { params: { 'filter[search]': query.trim() } });

        if (!cancelled) {
          setResults((res.data?.data ?? res.data ?? []) as T[]);
        }
      } catch {
        if (!cancelled) {
          setResults([]);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, searchPath]);

  const visible = results.filter((r) => !excludeIds.includes(r.id));

  return (
    <div className="relative">
      <input
        className={inputClass}
        placeholder={placeholder}
        aria-label={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {visible.length > 0 && (
        <ul role="listbox" className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg">
          {visible.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-50"
                onClick={async () => {
                  await onPick(item);
                  setQuery('');
                  setResults([]);
                }}
              >
                {label(item)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
