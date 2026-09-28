'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isAxiosError } from 'axios';
import ProductForm from '@/components/products/form/ProductForm';
import ProductFormSkeleton from '@/components/products/form/ProductFormSkeleton';
import type { ApiProduct, NamedOption } from '@/components/products/form/formModel';
import { buttonLink, buttonSecondary } from '@/components/ui/styles';
import api from '@/lib/api';
import type { Attribute } from '@/lib/catalogTypes';

type Loaded = { product: ApiProduct | null; categories: NamedOption[]; brands: NamedOption[]; attributes: Attribute[] };

type State = { status: 'loading' } | { status: 'ready'; data: Loaded } | { status: 'missing' } | { status: 'failed' };

const list = (body: unknown): NamedOption[] =>
  Array.isArray(body) ? body : ((body as { data?: NamedOption[] } | null)?.data ?? []);

export default function ProductPage() {
  const pathname = usePathname();
  // Читается один раз и из адреса, а не из useParams: после первого
  // сохранения форма меняет адрес на /products/{id} через
  // history.replaceState. Next синхронизирует с ним pathname, но не параметры
  // маршрута — при возврате «Назад» useParams отдал бы 'create', и открылась
  // бы пустая форма под адресом созданного товара.
  const [id] = useState(() => pathname.split('/').pop() ?? 'create');
  const [state, setState] = useState<State>({ status: 'loading' });

  const load = useCallback(async () => {
    setState({ status: 'loading' });

    try {
      const [categories, brands, attributes, product] = await Promise.all([
        api.get('/admin/categories').then((r) => list(r.data)).catch((): NamedOption[] => []),
        api.get('/admin/brands').then((r) => list(r.data)).catch((): NamedOption[] => []),
        api.get('/admin/attributes').then((r) => ((r.data?.data ?? []) as Attribute[])).catch((): Attribute[] => []),
        id === 'create' ? Promise.resolve(null) : api.get<{ data: ApiProduct }>(`/admin/products/${id}`).then((r) => r.data.data),
      ]);
      setState({ status: 'ready', data: { product, categories, brands, attributes } });
    } catch (error) {
      setState({ status: isAxiosError(error) && error.response?.status === 404 ? 'missing' : 'failed' });
    }
  }, [id]);

  useEffect(() => {
    // Загрузка при открытии — синхронизация с API, ради этого эффект и нужен.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (state.status === 'loading') {
    return <ProductFormSkeleton />;
  }

  if (state.status === 'missing' || state.status === 'failed') {
    return (
      <div className="space-y-3 py-16 text-center">
        <p className="text-lg font-semibold text-zinc-900">
          {state.status === 'missing' ? 'Товар не найден' : 'Не удалось загрузить товар'}
        </p>
        <div className="flex justify-center gap-4">
          {state.status === 'failed' && (
            <button type="button" className={buttonSecondary} onClick={() => void load()}>
              Повторить
            </button>
          )}
          <Link href="/products" className={buttonLink}>
            К списку товаров
          </Link>
        </div>
      </div>
    );
  }

  return <ProductForm initialProduct={state.data.product} categories={state.data.categories} brands={state.data.brands} attributes={state.data.attributes} />;
}
