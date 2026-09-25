'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { serverMessage } from '@/lib/errors';
import { createDraft, draftHref, type DraftKind } from '@/lib/warehouse';
import { toast } from '@/stores/toastStore';

/**
 * Создать черновик и перейти в него. `busy` держится до ухода со страницы —
 * кнопка не создаёт второй черновик двойным нажатием. Отказ сервера (нет
 * активного места хранения) — тостом; 5xx и сеть показал перехватчик api.
 */
export function useCreateDraft() {
  const router = useRouter();
  const [busy, setBusy] = useState<DraftKind | null>(null);

  const create = useCallback(
    async (kind: DraftKind, options: { storeId?: number | null; productId?: number } = {}) => {
      setBusy(kind);
      try {
        const id = await createDraft(kind, options);
        router.push(draftHref(kind, id));
      } catch (error) {
        const message = serverMessage(error);
        if (message) {
          toast.error(message);
        }
        setBusy(null);
      }
    },
    [router],
  );

  return { busy, create };
}
