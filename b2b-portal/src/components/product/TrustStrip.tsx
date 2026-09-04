"use client";

import { useTranslations } from "next-intl";

const TRUST_ITEMS = [
  { titleKey: "trustProduction", subtitleKey: "trustProductionSub" },
  { titleKey: "trustWarranty", subtitleKey: "trustWarrantySub" },
  { titleKey: "trustReturn", subtitleKey: "trustReturnSub" },
  { titleKey: "trustAssembly", subtitleKey: "trustAssemblySub" },
] as const;

// Fallback texts for when translations are missing
const FALLBACKS: Record<string, { title: string; subtitle: string }> = {
  trustProduction: { title: "Своё производство", subtitle: "Массив дуба, Алматы" },
  trustWarranty: { title: "18 месяцев гарантии", subtitle: "На каркас и покрытие" },
  trustReturn: { title: "Возврат 14 дней", subtitle: "Без объяснения причин" },
  trustAssembly: { title: "Сборка бесплатно", subtitle: "В день доставки" },
};

export function TrustStrip() {
  const t = useTranslations("product");

  function getText(key: string, fallback: string): string {
    return t(key) || fallback;
  }

  return (
    <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-0 rounded-[20px] border border-line bg-white dark:bg-card overflow-hidden shadow-[0_1px_2px_rgba(28,26,23,0.04),0_12px_32px_rgba(28,26,23,0.05)] dark:shadow-none">
      {TRUST_ITEMS.map((item, idx) => (
        <div
          key={item.titleKey}
          className={`px-4 py-4 lg:px-5 lg:py-4 ${
            idx > 0 ? "border-l border-line" : ""
          } ${idx >= 2 ? "border-t lg:border-t-0 border-line" : ""}`}
        >
          <div className="text-sm font-semibold text-ink leading-snug">
            {getText(item.titleKey, FALLBACKS[item.titleKey].title)}
          </div>
          <div className="mt-0.5 text-xs text-muted">
            {getText(item.subtitleKey, FALLBACKS[item.titleKey].subtitle)}
          </div>
        </div>
      ))}
    </div>
  );
}
