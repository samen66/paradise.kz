'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import api from '@/lib/api';
import { warehouseHref, type WriteOff } from '@/lib/warehouse';
import CrudModal from '@/components/ui/CrudModal';
import { buttonSecondary } from '@/components/ui/styles';
import { toWriteOffForm, WriteOffFields, writeOffSchema } from './WriteOffForm';

/**
 * «Списать»: шапка списания в модалке, затем карточка документа.
 * Этап 3 заменит модалку созданием черновика сразу.
 */
export default function NewWriteOffButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className={buttonSecondary} onClick={() => setOpen(true)}>
        Списать
      </button>
      {open && (
        <CrudModal
          title="Новое списание"
          schema={writeOffSchema}
          defaultValues={toWriteOffForm(null)}
          onSubmit={async (values) => {
            const res = await api.post<{ data: WriteOff }>('/admin/write-offs', values);
            router.push(warehouseHref.writeOff(res.data.data.id));
          }}
          onClose={() => setOpen(false)}
        >
          {(form) => <WriteOffFields form={form} />}
        </CrudModal>
      )}
    </>
  );
}
