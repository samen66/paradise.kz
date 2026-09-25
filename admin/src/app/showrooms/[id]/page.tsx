'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { isAxiosError } from 'axios';
import ShowroomForm from '@/components/showrooms/ShowroomForm';
import { buttonLink, buttonSecondary } from '@/components/ui/styles';
import api from '@/lib/api';
import type { Showroom } from '@/lib/showrooms';

type State = { status: 'loading' } | { status: 'ready'; showroom: Showroom } | { status: 'missing' } | { status: 'failed' };

export default function ShowroomPage() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<State>({ status: 'loading' });

  const load = useCallback(async () => {
    setState({ status: 'loading' });

    try {
      const res = await api.get<{ data: Showroom }>(`/admin/showrooms/${id}`);
      setState({ status: 'ready', showroom: res.data.data });
    } catch (error) {
      setState({ status: isAxiosError(error) && error.response?.status === 404 ? 'missing' : 'failed' });
    }
  }, [id]);

  useEffect(() => {
    // Загрузка при открытии — синхронизация с API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (state.status === 'loading') {
    return (
      <div role="status" aria-busy="true" aria-label="Загрузка шоурума" className="space-y-4">
        <div className="h-8 w-64 animate-pulse rounded-xl bg-zinc-200/70" />
        <div className="h-48 animate-pulse rounded-xl bg-zinc-200/70" />
        <div className="h-36 animate-pulse rounded-xl bg-zinc-200/70" />
      </div>
    );
  }

  if (state.status !== 'ready') {
    return (
      <div className="space-y-3 py-16 text-center">
        <p className="text-lg font-semibold text-zinc-900">{state.status === 'missing' ? 'Шоурум не найден' : 'Не удалось загрузить шоурум'}</p>
        <div className="flex justify-center gap-4">
          {state.status === 'failed' && (
            <button type="button" className={buttonSecondary} onClick={() => void load()}>
              Повторить
            </button>
          )}
          <Link href="/showrooms" className={buttonLink}>
            К списку шоурумов
          </Link>
        </div>
      </div>
    );
  }

  return <ShowroomForm initial={state.showroom} />;
}
