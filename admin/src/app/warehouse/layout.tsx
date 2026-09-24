'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import NewReceiptButton from '@/components/warehouse/NewReceiptButton';
import NewWriteOffButton from '@/components/warehouse/NewWriteOffButton';
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
              <>
                <NewReceiptButton />
                <NewWriteOffButton />
              </>
            }
          />
        )}
        {children}
      </div>
    </WarehouseSummaryProvider>
  );
}
