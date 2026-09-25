'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { formatTenge } from '@/lib/money';
import { productLabel } from '@/lib/text';
import {
  formatDateTime,
  formatQty,
  kindOfDocuments,
  lineCost,
  warehouseHref,
  type DraftKind,
  type GoodsReceipt,
  type WriteOff,
} from '@/lib/warehouse';
import DataTable, { type Column } from '@/components/ui/DataTable';
import Skeleton from '@/components/ui/Skeleton';
import { buttonGhost, buttonLink } from '@/components/ui/styles';
import AddProductField from './AddProductField';
import DocumentFields from './DocumentFields';
import DocumentFooter from './DocumentFooter';
import DocumentHeader from './DocumentHeader';
import DocumentLines from './DocumentLines';
import { useDocument, type LineRow } from './useDocument';

/** Карточка приёмки или списания: черновик правится на месте, проведённый — только читается. */
export default function DocumentScreen({ kind }: { kind: DraftKind }) {
  const { id } = useParams<{ id: string }>();
  const doc = useDocument(kind, id);

  if (doc.loadError === 'not_found') {
    return (
      <div className="space-y-3">
        <p className="text-zinc-700">Документ не найден.</p>
        <Link href={warehouseHref.documents(kindOfDocuments(kind))} className={buttonLink}>
          ← К документам
        </Link>
      </div>
    );
  }

  if (doc.loadError === 'error') {
    return (
      <div className="space-y-3">
        <p className="text-zinc-700">Не удалось загрузить документ.</p>
        <button type="button" className={buttonGhost} onClick={() => void doc.reload()}>
          Повторить
        </button>
      </div>
    );
  }

  if (!doc.header) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  const header = doc.header;
  const isDraft = header.status === 'draft';
  const title = kind === 'receipt' ? `Приёмка ${(header as GoodsReceipt).number || `№${header.id}`}` : (header as WriteOff).label;

  return (
    <div className={isDraft ? 'space-y-4 pb-40 lg:pb-0' : 'space-y-4'}>
      <DocumentHeader kind={kind} title={title} status={header.status} saveState={doc.saveState} onRetry={doc.retry} />

      {isDraft ? (
        <>
          <DocumentFields key={header.id} kind={kind} header={header} errors={doc.errors} onSave={doc.saveHeader} />
          <DocumentLines
            kind={kind}
            rows={doc.rows}
            highlightId={doc.highlightId}
            errors={doc.errors}
            onEdit={doc.editLine}
            onFlush={doc.flushLine}
            onRemove={(lineId) => void doc.removeLine(lineId)}
          />
          <div className="flex flex-col gap-2 md:flex-row">
            <AddProductField kind={kind} storeId={header.store_id} onPick={(product) => doc.addProduct(product.id)} />
          </div>
          <DocumentFooter kind={kind} totals={doc.totals} blocker={doc.blocker} onPost={doc.post} onDelete={doc.removeDraft} />
        </>
      ) : (
        <PostedDocument kind={kind} header={header} rows={doc.rows} />
      )}
    </div>
  );
}

function PostedDocument({ kind, header, rows }: { kind: DraftKind; header: GoodsReceipt | WriteOff; rows: LineRow[] }) {
  const columns: Column<LineRow>[] = [
    { key: 'product', header: 'Товар', mobile: 'title', render: (row) => productLabel(row.product) },
    { key: 'qty', header: 'Количество', className: 'text-right', mobile: 'badge', render: (row) => formatQty(row.quantity) },
    ...(kind === 'receipt'
      ? [
          { key: 'cost', header: 'Себестоимость', className: 'text-right', mobile: 'meta' as const, render: (row: LineRow) => formatTenge(row.unitCost) },
          {
            key: 'sum',
            header: 'Сумма',
            className: 'text-right',
            mobile: 'meta' as const,
            render: (row: LineRow) => formatTenge(lineCost(row.quantity, row.unitCost ?? 0)),
          },
        ]
      : []),
  ];
  const writeOffCost = kind === 'write_off' ? (header as WriteOff).total_cost : null;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
        <span>
          {kind === 'receipt' ? 'Проведена' : 'Проведено'} {formatDateTime(header.posted_at)}
          {header.user ? `, ${header.user.name}` : ''}
          {writeOffCost !== null ? ` · Себестоимость: ${formatTenge(writeOffCost)}` : ''}
        </span>
        <Link href={`${warehouseHref.movements}?document=${kind}:${header.id}`} className={buttonLink}>
          Движения по документу →
        </Link>
      </div>
      <DataTable columns={columns} rows={rows} emptyText="Позиций нет" />
    </>
  );
}
