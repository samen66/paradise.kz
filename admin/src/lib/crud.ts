'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import api from '@/lib/api';
import { serverMessage } from '@/lib/errors';
import { toast } from '@/stores/toastStore';

export type PageMeta = { current_page: number; last_page: number };

type ListBody<T> = T[] | { data: T[]; current_page?: number; last_page?: number };

/**
 * One REST collection: list (plain array, {data: []} or a Laravel paginator),
 * create, update, remove — each followed by a reload.
 *
 * `params.page`, если передан, важнее внутренней страницы — так список
 * берёт страницу из адреса.
 */
export function useResource<T extends { id: number }>(path: string | null, params?: Record<string, unknown>) {
  const [items, setItems] = useState<T[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const paramsKey = JSON.stringify(params ?? {});
  // Guards against an earlier request's response overwriting a later one's
  // (e.g. page/params change quickly): only the most recent reload() call
  // is allowed to commit state when its response comes back.
  const requestIdRef = useRef(0);

  const reload = useCallback(async () => {
    if (!path) {
      return;
    }

    const requestId = ++requestIdRef.current;

    setLoading(true);

    try {
      const res = await api.get<ListBody<T>>(path, { params: { page, ...JSON.parse(paramsKey) } });

      if (requestId !== requestIdRef.current) {
        return;
      }

      const body = res.data;

      if (Array.isArray(body)) {
        setItems(body);
        setMeta(null);
      } else {
        setItems(body.data ?? []);
        setMeta(body.last_page ? { current_page: body.current_page ?? 1, last_page: body.last_page } : null);
      }
    } catch {
      if (requestId === requestIdRef.current) {
        setItems([]);
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [path, paramsKey, page]);

  useEffect(() => {
    // Fetch-on-mount/dependency-change: reload() synchronizes with the API,
    // an external system, which is exactly what an effect is for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  const create = async (payload: unknown): Promise<T> => {
    if (!path) {
      throw new Error('useResource: path is not set');
    }

    const res = await api.post(path, payload);
    await reload();

    return (res.data?.data ?? res.data) as T;
  };

  const update = async (id: number, payload: unknown): Promise<T> => {
    if (!path) {
      throw new Error('useResource: path is not set');
    }

    const res = await api.put(`${path}/${id}`, payload);
    await reload();

    return (res.data?.data ?? res.data) as T;
  };

  const remove = async (id: number): Promise<boolean> => {
    try {
      await api.delete(`${path}/${id}`);
      await reload();
      toast.success('Удалено');

      return true;
    } catch (error) {
      const message = serverMessage(error);

      if (message) {
        toast.error(message);
      } else if (isAxiosError(error) && error.response && error.response.status < 500 && ![401, 403].includes(error.response.status)) {
        // 401/403/5xx/network are already reported by the axios interceptor;
        // this covers the remaining 4xx (404/400/409/…) that would otherwise
        // fail silently.
        toast.error('Не удалось удалить');
      }

      return false;
    }
  };

  return { items, meta, page, setPage, loading, reload, create, update, remove };
}

/** Что возвращает useResource — для передачи одного списка нескольким компонентам. */
export type Resource<T extends { id: number }> = ReturnType<typeof useResource<T>>;
