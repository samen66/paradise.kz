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

  // Options load asynchronously: rendering the select before they arrive
  // would show it empty even though a react-hook-form default `store_id`
  // is already set, since the matching <option> doesn't exist yet.
  if (stores.loading && stores.items.length === 0) {
    return <div className={inputClass}>Загрузка…</div>;
  }

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
