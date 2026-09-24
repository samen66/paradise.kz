'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { parseDocumentKind, warehouseHref } from '@/lib/warehouse';
import LinkTabs from '@/components/ui/LinkTabs';
import ReceiptsList from '@/components/warehouse/ReceiptsList';
import WriteOffsList from '@/components/warehouse/WriteOffsList';

function DocumentsView() {
  const kind = parseDocumentKind(useSearchParams().get('kind'));

  return (
    <div className="space-y-4">
      <LinkTabs
        label="Вид документов"
        active={kind}
        tabs={[
          { key: 'receipts', href: warehouseHref.documents('receipts'), label: 'Приёмки' },
          { key: 'write_offs', href: warehouseHref.documents('write_offs'), label: 'Списания' },
        ]}
      />
      {kind === 'receipts' ? <ReceiptsList /> : <WriteOffsList />}
    </div>
  );
}

export default function DocumentsPage() {
  // useSearchParams needs a Suspense boundary for the static build.
  return (
    <Suspense fallback={null}>
      <DocumentsView />
    </Suspense>
  );
}
