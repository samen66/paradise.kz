'use client';

import { z } from 'zod';
import type { NamedOption } from '@/components/products/form/formModel';
import CrudModal from '@/components/ui/CrudModal';
import TranslatableField from '@/components/ui/TranslatableField';
import api from '@/lib/api';
import { REQUIRED } from '@/lib/validation';

const LONG = 'Не длиннее 255 символов';

const schema = z.object({
  name: z.object({ ru: z.string().trim().min(1, REQUIRED).max(255, LONG), kk: z.string().max(255, LONG) }),
});

type Props = {
  /** Текст из поиска «+ Создать „…“». */
  initialName: string;
  onSaved: (brand: NamedOption) => void;
  onClose: () => void;
};

/** Новый бренд прямо из карточки товара: только название, slug сделает сервер. */
export default function BrandFormSheet({ initialName, onSaved, onClose }: Props) {
  return (
    <CrudModal
      title="Новый бренд"
      schema={schema}
      defaultValues={{ name: { ru: initialName, kk: '' } }}
      submitLabel="Создать"
      onSubmit={async (values) => {
        const res = await api.post('/admin/brands', { name: values.name, is_active: true });
        onSaved((res.data?.data ?? res.data) as NamedOption);
      }}
      onClose={onClose}
    >
      {(form) => <TranslatableField form={form} name="name" label="Название" required />}
    </CrudModal>
  );
}
