'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { warehouseHref } from '@/lib/warehouse';
import LinkTabs, { type LinkTab } from '@/components/ui/LinkTabs';
import PageHeader from '@/components/ui/PageHeader';
import { buttonGhost } from '@/components/ui/styles';

/** Вкладки раздела. «Обзор» добавит этап 2. */
export const WAREHOUSE_TABS: LinkTab[] = [
  { key: 'stock', href: warehouseHref.stock, label: 'Остатки' },
  { key: 'movements', href: warehouseHref.movements, label: 'Движения' },
  { key: 'documents', href: warehouseHref.documents(), label: 'Документы' },
];

/** Вкладка, которой принадлежит адрес, или null — на документе и в справочниках шапки раздела нет. */
export function warehouseTabFor(pathname: string): string | null {
  return WAREHOUSE_TABS.find((tab) => tab.href.split('?')[0] === pathname)?.key ?? null;
}

/**
 * Шапка раздела «Склад»: заголовок, действия, вкладки. Липкая на телефоне
 * (через `below` у PageHeader), так что вкладки и «Принять товар» всегда
 * под рукой.
 */
export default function WarehouseHeader({ active, actions }: { active: string; actions?: ReactNode }) {
  return (
    <PageHeader
      title="Склад"
      actions={
        <>
          {actions}
          <Link href={warehouseHref.stores} className={buttonGhost} aria-label="Справочники" title="Справочники">
            <span aria-hidden="true">⚙</span>
            <span className="ml-1.5 hidden md:inline">Справочники</span>
          </Link>
        </>
      }
      below={<LinkTabs label="Разделы склада" tabs={WAREHOUSE_TABS} active={active} />}
    />
  );
}
