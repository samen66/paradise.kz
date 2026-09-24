'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import WarehouseHeader, { warehouseTabFor } from '@/components/warehouse/WarehouseHeader';

/**
 * Раздел «Склад». На страницах-вкладках — общая шапка с вкладками; карточка
 * документа и справочники рисуют свою шапку с «← назад».
 */
export default function WarehouseLayout({ children }: { children: ReactNode }) {
  const tab = warehouseTabFor(usePathname());

  return (
    <div>
      {tab && <WarehouseHeader active={tab} />}
      {children}
    </div>
  );
}
