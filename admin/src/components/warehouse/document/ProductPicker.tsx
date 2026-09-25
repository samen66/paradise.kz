'use client';

import { useMemo, useState } from 'react';
import { useResource } from '@/lib/crud';
import { plural, ru, type Translatable } from '@/lib/text';
import { useProductPicker } from '@/lib/useProductPicker';
import { formatQty, type DraftKind, type PickerProduct } from '@/lib/warehouse';
import FilterChips from '@/components/ui/FilterChips';
import Modal from '@/components/ui/Modal';
import { buttonPrimary, inputClass } from '@/components/ui/styles';
import LoadMoreSentinel from './LoadMoreSentinel';
import { pickerMeta } from './pickerText';
import ProductThumb from './ProductThumb';
import QuantityStepper from './QuantityStepper';
import type { LineRow } from './useDocument';

type Category = { id: number; parent_id: number | null; name: Translatable };

type Props = {
  kind: DraftKind;
  storeId: number;
  rows: LineRow[];
  onAdd: (items: { product_id: number; quantity: string }[]) => Promise<boolean>;
  onClose: () => void;
};

const RECENT = 'recent';

/**
 * «Подбор»: каталог с поиском и категориями верхнего уровня (с
 * подкатегориями), у строки — степпер; нажатие на строку — +1. Выбор копится
 * при смене поиска и категории и уходит одним запросом (`items/batch`). В
 * списании — только товары с остатком, и больше остатка минус уже внесённое
 * не выбрать. На ПК — панель справа, на телефоне — весь экран.
 */
export default function ProductPicker({ kind, storeId, rows, onAdd, onClose }: Props) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [selected, setSelected] = useState<Map<number, number>>(new Map());
  const [busy, setBusy] = useState(false);
  const categories = useResource<Category>('/admin/categories');
  const picker = useProductPicker({
    storeId,
    search,
    categoryId: category && category !== RECENT ? Number(category) : null,
    recent: category === RECENT,
    inStock: kind === 'write_off',
  });

  const inDocument = useMemo(() => new Map(rows.map((row) => [row.productId, Number(row.quantity) || 0])), [rows]);
  const limitOf = (product: PickerProduct): number | undefined =>
    kind === 'write_off' ? Math.max(0, product.on_hand - (inDocument.get(product.id) ?? 0)) : undefined;

  const setQuantity = (product: PickerProduct, quantity: number) =>
    setSelected((current) => {
      const next = new Map(current);
      const limit = limitOf(product);
      const value = Math.max(0, limit === undefined ? quantity : Math.min(limit, quantity));
      if (value > 0) {
        next.set(product.id, value);
      } else {
        next.delete(product.id);
      }
      return next;
    });

  const count = selected.size;
  const units = [...selected.values()].reduce((sum, quantity) => sum + quantity, 0);
  const documentWord = kind === 'receipt' ? 'в приёмке' : 'в списании';

  const close = () => {
    if (count > 0 && !window.confirm(`Отменить подбор? Выбрано ${count} ${plural(count, ['товар', 'товара', 'товаров'])}.`)) {
      return;
    }
    onClose();
  };

  const submit = async () => {
    setBusy(true);
    try {
      const added = await onAdd([...selected].map(([productId, quantity]) => ({ product_id: productId, quantity: String(quantity) })));
      if (added) {
        onClose();
      }
    } finally {
      setBusy(false);
    }
  };

  const chips = [
    { value: RECENT, label: 'Недавние' },
    { value: '', label: 'Все' },
    ...categories.items.filter((c) => c.parent_id === null).map((c) => ({ value: String(c.id), label: ru(c.name) || `#${c.id}` })),
  ];

  return (
    <Modal
      title="Подбор"
      variant="panel"
      onClose={close}
      footer={
        <button type="button" className={`${buttonPrimary} w-full`} disabled={count === 0 || busy} onClick={() => void submit()}>
          {count === 0
            ? 'Выберите товары'
            : `Добавить ${count} ${plural(count, ['позицию', 'позиции', 'позиций'])} · ${formatQty(units)} шт`}
        </button>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-zinc-500">Выбрано: {count}</p>
        <input
          type="search"
          aria-label="Поиск в подборе"
          placeholder="Название, код или артикул"
          className={inputClass}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <FilterChips label="Категории" options={chips} value={category} onChange={setCategory} />
        <ul className="divide-y divide-zinc-100">
          {picker.items.map((product) => {
            const quantity = selected.get(product.id) ?? 0;
            const limit = limitOf(product);
            const already = inDocument.get(product.id);
            const name = ru(product.name) || `#${product.id}`;
            return (
              <li key={product.id} data-testid="picker-row" className={`flex items-center gap-3 py-2 ${quantity > 0 ? 'bg-blue-50/60' : ''}`}>
                <ProductThumb url={product.thumb_url} />
                <button
                  type="button"
                  data-testid="picker-pick"
                  className="min-h-11 min-w-0 flex-1 text-left disabled:opacity-60"
                  disabled={limit !== undefined && quantity >= limit}
                  onClick={() => setQuantity(product, quantity + 1)}
                >
                  <span className="block text-sm font-medium text-zinc-900">{name}</span>
                  <span className="block text-xs text-zinc-500">
                    {pickerMeta(product, kind)}
                    {already ? ` · ${documentWord}: ${formatQty(already)}` : ''}
                  </span>
                </button>
                <QuantityStepper
                  value={String(quantity)}
                  label={name}
                  min={0}
                  max={limit}
                  onChange={(value) => {
                    const next = Number(value);
                    if (Number.isFinite(next)) {
                      setQuantity(product, next);
                    }
                  }}
                />
              </li>
            );
          })}
        </ul>
        {picker.hasMore && <LoadMoreSentinel onVisible={picker.loadMore} disabled={picker.loading} />}
        {picker.loading && <p className="text-sm text-zinc-400">Загрузка…</p>}
        {!picker.loading && picker.items.length === 0 && <p className="text-sm text-zinc-500">Ничего не найдено.</p>}
      </div>
    </Modal>
  );
}
