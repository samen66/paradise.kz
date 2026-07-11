"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { CatalogSearchParams } from "./CatalogView";

export function ActiveFilters({
  searchParams,
  pathname,
}: {
  searchParams: CatalogSearchParams;
  pathname: string;
}) {
  const t = useTranslations("catalog");
  const router = useRouter();

  const activeKeys = Object.keys(searchParams).filter(
    (key) => key !== "page" && key !== "sort" && searchParams[key]
  );

  if (activeKeys.length === 0) return null;

  const removeFilter = (keyToRemove: string) => {
    const params = new URLSearchParams();
    Object.entries(searchParams).forEach(([k, v]) => {
      if (k !== keyToRemove && v) {
        if (Array.isArray(v)) {
          v.forEach((val) => params.append(k, val));
        } else {
          params.append(k, v);
        }
      }
    });
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const clearAll = () => {
    const params = new URLSearchParams();
    if (searchParams.sort) params.set("sort", searchParams.sort as string);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      {activeKeys.map((key) => {
        let label = key;
        if (key === "brand") label = t("brand");
        if (key === "price_min") label = `${t("from")} ${searchParams[key]}`;
        if (key === "price_max") label = `${t("to")} ${searchParams[key]}`;
        if (key === "in_stock") label = t("onlyInStock");
        if (key.startsWith("attr[")) {
          label = searchParams[key] as string;
        }

        return (
          <span
            key={key}
            className="inline-flex items-center gap-1.5 rounded-full bg-surface pl-3 pr-2 py-1.5 text-sm font-medium text-ink"
          >
            {label}
            <button
              type="button"
              onClick={() => removeFilter(key)}
              className="grid h-5 w-5 place-items-center rounded-full text-muted hover:bg-white hover:text-ink transition"
              aria-label="Удалить"
            >
              ✕
            </button>
          </span>
        );
      })}
      
      {activeKeys.length > 1 && (
        <button
          type="button"
          onClick={clearAll}
          className="ml-2 text-sm font-medium text-muted underline underline-offset-4 hover:text-ink hover:no-underline"
        >
          {t("reset")}
        </button>
      )}
    </div>
  );
}
