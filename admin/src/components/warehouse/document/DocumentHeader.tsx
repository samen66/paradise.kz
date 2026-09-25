import type { SaveState } from '@/lib/useAutosave';
import { kindOfDocuments, warehouseHref, type DocumentStatus, type DraftKind } from '@/lib/warehouse';
import PageHeader from '@/components/ui/PageHeader';
import DocumentStatusBadge from '../DocumentStatusBadge';

type Props = { kind: DraftKind; title: string; status: DocumentStatus; saveState: SaveState; onRetry: () => void };

/** «← Документы», заголовок, статус и — у черновика — индикатор сохранения. */
export default function DocumentHeader({ kind, title, status, saveState, onRetry }: Props) {
  return (
    <PageHeader
      title={title}
      back={warehouseHref.documents(kindOfDocuments(kind))}
      actions={
        <div className="flex items-center gap-3">
          <DocumentStatusBadge status={status} postedLabel={kind === 'receipt' ? 'Проведена' : 'Проведено'} />
          {status === 'draft' && (
            <p role="status" aria-live="polite" className="text-sm">
              {saveState === 'saving' && <span className="text-zinc-500">Сохраняю…</span>}
              {saveState === 'saved' && <span className="text-green-700">✓ Сохранено</span>}
              {saveState === 'error' && (
                <span className="text-red-600">
                  ⚠ Не сохранено{' '}
                  <button type="button" className="font-medium underline" onClick={onRetry}>
                    Повторить
                  </button>
                </span>
              )}
            </p>
          )}
        </div>
      }
    />
  );
}
