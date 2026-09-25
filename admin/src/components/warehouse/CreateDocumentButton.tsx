'use client';

import { useSearchParams } from 'next/navigation';
import type { DraftKind } from '@/lib/warehouse';
import { buttonPrimary, buttonSecondary } from '@/components/ui/styles';
import { useCreateDraft } from './useCreateDraft';

type Props = { kind: DraftKind; storeId?: number | null; className?: string };

/** «+ Принять товар» / «Списать»: черновик без модалки, сразу его карточка. */
export default function CreateDocumentButton({ kind, storeId = null, className }: Props) {
  const { busy, create } = useCreateDraft();

  return (
    <button
      type="button"
      disabled={busy !== null}
      className={className ?? (kind === 'receipt' ? buttonPrimary : buttonSecondary)}
      onClick={() => void create(kind, { storeId })}
    >
      {busy ? 'Создаю…' : kind === 'receipt' ? '+ Принять товар' : 'Списать'}
    </button>
  );
}

/**
 * Кнопки шапки раздела. Склад — из `?store_id=` текущей вкладки (фильтр
 * «Остатков» или «Документов»), иначе сервер возьмёт склад по умолчанию.
 * Читает адрес — рендерить под `<Suspense>`.
 */
export function HeaderCreateButtons() {
  const params = useSearchParams();
  const storeId = Number(params.get('store_id')) || null;

  return (
    <>
      <CreateDocumentButton kind="receipt" storeId={storeId} />
      <CreateDocumentButton kind="write_off" storeId={storeId} />
    </>
  );
}
