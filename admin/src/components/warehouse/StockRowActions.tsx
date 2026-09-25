'use client';

import { useRef, useState } from 'react';
import { useIsDesktop } from '@/lib/useIsDesktop';
import ActionSheet, { type SheetAction } from '@/components/ui/ActionSheet';
import { useCreateDraft } from './useCreateDraft';

type Props = { productId: number; productName: string; stock: number; storeId: number | null };

/** Примерная высота меню — только чтобы решить, открывать вверх или вниз. */
const MENU_HEIGHT_ESTIMATE = 120;

/**
 * «⋯» в строке «Остатков»: принять или списать этот товар — черновик с ним
 * на складе из фильтра. «Списать» — только при остатке. На телефоне —
 * ActionSheet, на ПК — выпадашка `position: fixed` от кнопки (как
 * OrderRowActions: `absolute` обрезал бы `overflow-hidden` таблицы).
 */
export default function StockRowActions({ productId, productName, stock, storeId }: Props) {
  const isDesktop = useIsDesktop();
  const { busy, create } = useCreateDraft();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top?: number; bottom?: number; right: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const actions: SheetAction[] = [
    { key: 'receive', label: 'Принять товар', onSelect: () => void create('receipt', { storeId, productId }) },
    ...(stock > 0 ? [{ key: 'write-off', label: 'Списать', onSelect: () => void create('write_off', { storeId, productId }) }] : []),
  ];

  const toggle = () => {
    if (!isDesktop) {
      setOpen(true);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      const upward = window.innerHeight - rect.bottom < MENU_HEIGHT_ESTIMATE;
      setPosition({
        right: window.innerWidth - rect.right,
        ...(upward ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
      });
    }
    setOpen((v) => !v);
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        disabled={busy !== null}
        aria-label={`Действия: ${productName}`}
        aria-expanded={open}
        onClick={toggle}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-2 py-1 text-zinc-500 hover:bg-zinc-100 disabled:opacity-50 md:min-h-0 md:min-w-0"
      >
        {busy ? '…' : '⋯'}
      </button>

      {open && isDesktop && position && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div role="menu" style={{ position: 'fixed', ...position }} className="z-20 min-w-48 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
            {actions.map((action) => (
              <button
                key={action.key}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  action.onSelect();
                }}
                className="block w-full px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50"
              >
                {action.label}
              </button>
            ))}
          </div>
        </>
      )}

      {open && !isDesktop && <ActionSheet title={productName} actions={actions} onClose={() => setOpen(false)} />}
    </div>
  );
}
