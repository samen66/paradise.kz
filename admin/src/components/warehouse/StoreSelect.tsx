'use client';

import type { Ref, SelectHTMLAttributes } from 'react';
import { useResource } from '@/lib/crud';
import type { Store } from '@/lib/warehouse';
import { inputClass } from '@/components/ui/styles';

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  ref?: Ref<HTMLSelectElement>;
  emptyLabel?: string;
};

/** Warehouse picker for forms (spread `register(...)`) and filters (controlled). */
export default function StoreSelect({ emptyLabel = 'Выберите склад', className, ...props }: Props) {
  const stores = useResource<Store>('/admin/stores');

  return (
    <select className={`${inputClass} ${className ?? ''}`} {...props}>
      <option value="">{emptyLabel}</option>
      {stores.items.map((store) => (
        <option key={store.id} value={store.id}>
          {store.name}
          {store.is_active ? '' : ' (выключен)'}
        </option>
      ))}
    </select>
  );
}
