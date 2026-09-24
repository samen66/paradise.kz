'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import api from '@/lib/api';
import { useResource } from '@/lib/crud';
import { warehouseHref, type GoodsReceipt, type Supplier } from '@/lib/warehouse';
import CrudModal from '@/components/ui/CrudModal';
import { buttonPrimary } from '@/components/ui/styles';
import { ReceiptFields, receiptSchema, toReceiptForm, toReceiptPayload } from './GoodsReceiptForm';

/**
 * «+ Принять товар»: шапка приёмки в модалке, затем карточка документа.
 * Этап 3 заменит модалку созданием черновика сразу.
 */
export default function NewReceiptButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className={buttonPrimary} onClick={() => setOpen(true)}>
        + Принять товар
      </button>
      {open && <NewReceiptModal onClose={() => setOpen(false)} />}
    </>
  );
}

/** Отдельный компонент — поставщики грузятся, только когда модалка открыта. */
function NewReceiptModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const suppliers = useResource<Supplier>('/admin/suppliers');

  return (
    <CrudModal
      title="Новая приёмка"
      schema={receiptSchema}
      defaultValues={toReceiptForm(null)}
      onSubmit={async (values) => {
        const res = await api.post<{ data: GoodsReceipt }>('/admin/goods-receipts', toReceiptPayload(values));
        router.push(warehouseHref.receipt(res.data.data.id));
      }}
      onClose={onClose}
    >
      {(form) => <ReceiptFields form={form} suppliers={suppliers.items} />}
    </CrudModal>
  );
}
