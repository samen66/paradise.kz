'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import NoActiveStoreWarning from '@/components/NoActiveStoreWarning';

/**
 * Landing page of the admin panel.
 *
 * It reads `has_active_store` off the warehouse summary so a manager meets the
 * "no active warehouse" state here rather than through a customer's failed
 * checkout.
 */
export default function Home() {
  const [hasActiveStore, setHasActiveStore] = useState<boolean | null>(null);

  useEffect(() => {
    api.get<{ data: { has_active_store: boolean } }>('/admin/stock/summary')
      .then((res) => setHasActiveStore(res.data?.data?.has_active_store ?? null))
      .catch((err) => console.error('Failed to fetch stock', err));
  }, []);

  return (
    <div>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Paradise Admin</h1>
          <p className="text-sm text-gray-500 mt-1">
            Операционная админка: заказы, товары, остатки, клиенты.
          </p>
        </div>

        <NoActiveStoreWarning hasActiveStore={hasActiveStore} />
      </div>
    </div>
  );
}
