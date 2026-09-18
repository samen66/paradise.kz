"use client";

import { useTranslations } from "next-intl";

export function PendingApprovalBanner() {
  const t = useTranslations("approval");

  return (
    <div role="status" className="border-b border-line bg-mint/40">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:gap-3 sm:px-6 lg:px-10">
        <span className="font-semibold text-mint-ink">{t("pendingTitle")}</span>
        <span className="text-ink">{t("pendingText")}</span>
      </div>
    </div>
  );
}
