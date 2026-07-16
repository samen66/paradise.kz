"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";

export function SortSelect({ isB2B }: { isB2B?: boolean }) {
  const t = useTranslations("catalog");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="hidden text-muted sm:inline">{t("sort")}:</span>
      <select
        value={searchParams.get("sort") ?? "name"}
        onChange={(event) => {
          const params = new URLSearchParams(searchParams.toString());
          params.set("sort", event.target.value);
          params.delete("page");
          router.push(`${pathname}?${params.toString()}`);
        }}
        className="rounded-full border border-line bg-white px-4 py-2 text-ink outline-none focus:border-line-strong"
      >
        <option value="name">{t("sortName")}</option>
        {!isB2B && <option value="price">{t("sortPriceAsc")}</option>}
        {!isB2B && <option value="-price">{t("sortPriceDesc")}</option>}
        <option value="-created_at">{t("sortNew")}</option>
      </select>
    </label>
  );
}
