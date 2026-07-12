"use client";

import { useLocale } from "next-intl";
import { useParams } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Link, usePathname } from "@/i18n/navigation";

const labels: Record<string, string> = { ru: "Рус", kk: "Қаз" };

export function LocaleSwitcher() {
  const pathname = usePathname();
  const params = useParams();
  const locale = (params.locale as string) || useLocale();

  return (
    <span className="flex gap-2">
      {routing.locales.map((candidate) => (
        <Link
          key={candidate}
          href={pathname as any}
          locale={candidate}
          className={candidate === locale ? "font-semibold text-ink" : "text-muted hover:text-ink"}
        >
          {labels[candidate]}
        </Link>
      ))}
    </span>
  );
}
