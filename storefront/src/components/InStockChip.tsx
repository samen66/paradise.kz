"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Chip } from "./ui/Chip";
import type { CatalogSearchParams } from "./CatalogView";

export function InStockChip({
  searchParams,
  pathname,
}: {
  searchParams: CatalogSearchParams;
  pathname: string;
}) {
  const t = useTranslations("catalog");
  const router = useRouter();
  const isActive = searchParams.in_stock === "1";

  const toggle = () => {
    const params = new URLSearchParams();
    Object.entries(searchParams).forEach(([k, v]) => {
      if (k !== "in_stock" && v) {
        if (Array.isArray(v)) {
          v.forEach((val) => params.append(k, val));
        } else {
          params.append(k, v);
        }
      }
    });
    
    if (!isActive) {
      params.append("in_stock", "1");
    }
    
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <Chip active={isActive} onClick={toggle}>
      {t("onlyInStock")}
    </Chip>
  );
}
