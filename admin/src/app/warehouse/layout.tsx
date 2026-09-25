'use client';

import { usePathname } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import { HeaderCreateButtons } from '@/components/warehouse/CreateDocumentButton';
import WarehouseHeader, { warehouseTabFor } from '@/components/warehouse/WarehouseHeader';
import { WarehouseSummaryProvider } from '@/components/warehouse/WarehouseSummary';

/**
 * Раздел «Склад». На страницах-вкладках — общая шапка с вкладками; карточка
 * документа и справочники рисуют свою шапку с «← назад».
 */
export default function WarehouseLayout({ children }: { children: ReactNode }) {
  const tab = warehouseTabFor(usePathname());

  return (
    <WarehouseSummaryProvider>
      <div>
        {tab && (
          <WarehouseHeader
            active={tab}
            actions={
              <Suspense fallback={null}>
                <HeaderCreateButtons />
              </Suspense>
            }
          />
        )}
        {children}
      </div>
    </WarehouseSummaryProvider>
  );
}
