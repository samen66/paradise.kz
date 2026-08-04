import React from "react";
import { useTranslations } from "next-intl";

interface DeliverySummaryCardProps {
  freeDelivery?: boolean;
  deliveryDateStr?: string;
  assemblyStr?: string;
  warrantyStr?: string;
}

export function DeliverySummaryCard({
  freeDelivery = true,
  deliveryDateStr = "Завтра",
  assemblyStr = "В день доставки",
  warrantyStr = "18 месяцев",
}: DeliverySummaryCardProps) {
  // Using static text as per the design until dynamic API is added.
  // Translating where possible or falling back to defaults.

  return (
    <div className="flex flex-col gap-3 rounded-[20px] border border-line bg-white dark:bg-card p-5 text-sm shadow-[0_1px_2px_rgba(28,26,23,0.04),0_12px_32px_rgba(28,26,23,0.05)] dark:shadow-none sm:px-7 sm:py-[22px]">
      <div className="flex justify-between gap-3">
        <span className="text-muted">Доставка по Алматы</span>
        {freeDelivery ? (
          <span className="font-semibold text-mint-ink">Бесплатно</span>
        ) : (
          <span className="font-medium text-ink">По тарифам</span>
        )}
      </div>
      <div className="flex justify-between gap-3">
        <span className="text-muted">Срок доставки</span>
        <span className="font-medium text-ink">{deliveryDateStr}</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="text-muted">Сборка и подъём</span>
        <span className="font-medium text-ink">{assemblyStr}</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="text-muted">Гарантия</span>
        <span className="font-medium text-ink">{warrantyStr}</span>
      </div>
    </div>
  );
}
