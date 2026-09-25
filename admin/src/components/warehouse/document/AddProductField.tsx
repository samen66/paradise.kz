'use client';

import { useId, useState, type KeyboardEvent } from 'react';
import { ru } from '@/lib/text';
import { useIsDesktop } from '@/lib/useIsDesktop';
import { useProductPicker } from '@/lib/useProductPicker';
import type { DraftKind, PickerProduct } from '@/lib/warehouse';
import Modal from '@/components/ui/Modal';
import { buttonGhost, buttonLink, inputClass } from '@/components/ui/styles';
import LoadMoreSentinel from './LoadMoreSentinel';
import { pickerMeta } from './pickerText';
import ProductThumb from './ProductThumb';

type Props = { kind: DraftKind; storeId: number; onPick: (product: PickerProduct) => Promise<void> };

const RECENT_LIMIT = 8;

/**
 * «+ Товар»: список открывается сразу по фокусу — «Недавно принимали» и
 * «Весь каталог», ввод фильтрует. ↑/↓ — выбор, Enter — добавить, Esc —
 * закрыть. После добавления поле чистится и остаётся в фокусе. На телефоне —
 * кнопка, открывающая тот же поиск на весь экран.
 */
export default function AddProductField({ kind, storeId, onPick }: Props) {
  const isDesktop = useIsDesktop();
  const [panelOpen, setPanelOpen] = useState(false);

  if (isDesktop) {
    return <ProductSearch kind={kind} storeId={storeId} onPick={onPick} layout="popover" />;
  }

  return (
    <>
      <button type="button" className={`${buttonGhost} w-full`} onClick={() => setPanelOpen(true)}>
        + Добавить товар
      </button>
      {panelOpen && (
        <Modal title="Добавить товар" variant="panel" onClose={() => setPanelOpen(false)}>
          <ProductSearch kind={kind} storeId={storeId} onPick={onPick} layout="panel" onDone={() => setPanelOpen(false)} />
        </Modal>
      )}
    </>
  );
}

type SearchProps = Props & { layout: 'popover' | 'panel'; onDone?: () => void };

function ProductSearch({ kind, storeId, onPick, layout, onDone }: SearchProps) {
  const listId = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(layout === 'panel');
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const inStock = kind === 'write_off';
  const searching = query.trim() !== '';

  const recent = useProductPicker({ storeId, recent: true, inStock, enabled: open && !searching });
  const all = useProductPicker({ storeId, search: query, inStock, enabled: open });
  const recentItems = searching ? [] : recent.items.slice(0, RECENT_LIMIT);
  const options = [...recentItems, ...all.items];
  const settled = all.term === query.trim() && !all.loading;

  const pick = async (product: PickerProduct) => {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      await onPick(product);
      setQuery('');
      setActive(0);
      onDone?.();
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      const product = options[active];
      if (product && settled) {
        e.preventDefault();
        void pick(product);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      onDone?.();
    }
  };

  const option = (product: PickerProduct, index: number, section: string) => (
    <li
      key={`${section}-${product.id}`}
      role="option"
      aria-selected={index === active}
      onMouseDown={(e) => e.preventDefault()}
      onMouseEnter={() => setActive(index)}
      onClick={() => void pick(product)}
      className={`flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 ${index === active ? 'bg-blue-50' : ''}`}
    >
      <ProductThumb url={product.thumb_url} />
      <div className="min-w-0">
        <div className="text-sm font-medium text-zinc-900">{ru(product.name) || `#${product.id}`}</div>
        <div className="text-xs text-zinc-500">{pickerMeta(product, kind)}</div>
      </div>
    </li>
  );

  const list = open && (
    <ul
      id={listId}
      role="listbox"
      aria-label="Товары"
      className={
        layout === 'popover'
          ? 'absolute z-40 mt-1 max-h-80 w-full overflow-y-auto rounded-xl border border-zinc-200 bg-white py-1 shadow-lg'
          : 'mt-3 -mx-4 md:-mx-6'
      }
    >
      {recentItems.length > 0 && (
        <li role="presentation" className="px-3 pt-2 pb-1 text-xs font-medium uppercase text-zinc-400">
          Недавно принимали
        </li>
      )}
      {recentItems.map((product, i) => option(product, i, 'recent'))}
      {!searching && (
        <li role="presentation" className="px-3 pt-2 pb-1 text-xs font-medium uppercase text-zinc-400">
          Весь каталог
        </li>
      )}
      {all.items.map((product, i) => option(product, recentItems.length + i, 'all'))}
      {all.hasMore && (
        <li role="presentation">
          <LoadMoreSentinel onVisible={all.loadMore} disabled={all.loading} />
        </li>
      )}
      {all.loading && (
        <li role="presentation" className="px-3 py-2 text-sm text-zinc-400">
          Загрузка…
        </li>
      )}
      {searching && settled && all.items.length === 0 && (
        <li role="presentation" className="px-3 py-3 text-sm text-zinc-600">
          Ничего не найдено по «{query.trim()}».{' '}
          <a href="/products/create" target="_blank" rel="noopener" className={buttonLink}>
            Создать товар
          </a>
        </li>
      )}
    </ul>
  );

  return (
    <div className={layout === 'popover' ? 'relative flex-1' : ''}>
      <input
        type="search"
        role="combobox"
        aria-expanded={Boolean(open)}
        aria-controls={listId}
        aria-label={layout === 'popover' ? 'Добавить товар' : 'Поиск товара'}
        placeholder="+ Товар: название, код…"
        autoFocus={layout === 'panel'}
        className={inputClass}
        value={query}
        aria-busy={busy}
        onFocus={() => setOpen(true)}
        onBlur={() => layout === 'popover' && setOpen(false)}
        onChange={(e) => {
          // Пока товар добавляется, ввод не принимается, но поле не
          // выключается — `disabled` снял бы с него фокус.
          if (busy) {
            return;
          }
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />
      {list}
    </div>
  );
}
