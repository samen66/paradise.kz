import type { ReactNode } from 'react';
import { warehouseHref } from '@/lib/warehouse';
import LinkTabs from '@/components/ui/LinkTabs';
import PageHeader from '@/components/ui/PageHeader';

/** Шапка справочников склада: «← Склад», переключатель «Места хранения / Поставщики». */
export default function DirectoryHeader({ active, actions }: { active: 'stores' | 'suppliers'; actions?: ReactNode }) {
  return (
    <PageHeader
      title="Справочники"
      back={warehouseHref.overview}
      actions={actions}
      below={
        <LinkTabs
          label="Справочники склада"
          active={active}
          tabs={[
            { key: 'stores', href: warehouseHref.stores, label: 'Места хранения' },
            { key: 'suppliers', href: warehouseHref.suppliers, label: 'Поставщики' },
          ]}
        />
      }
    />
  );
}
