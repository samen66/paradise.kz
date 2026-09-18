"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ApiValidationError, apiPatch } from "@/lib/api";

/**
 * "Cancel order" with an inline are-you-sure step. The API only lets a
 * customer cancel an order nobody has confirmed yet; its refusal message is
 * shown as is.
 */
export function CancelOrderButton({
  orderId,
  orderNumber,
  token,
  onCancelled,
}: {
  orderId: number;
  orderNumber: string;
  token: string;
  onCancelled: () => void;
}) {
  const t = useTranslations("account");
  const locale = useLocale();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      await apiPatch(`/account/orders/${orderId}/cancel`, {}, { token, locale });
      onCancelled();
    } catch (caught) {
      setError(caught instanceof ApiValidationError ? caught.message : t("cancelFailed"));
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {confirming ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-ink">{t("cancelConfirm", { number: orderNumber })}</span>
          <button
            type="button"
            onClick={cancel}
            disabled={busy}
            className="rounded-[10px] bg-sale px-4 py-2 text-[13px] font-medium text-sale-ink transition hover:opacity-90 disabled:opacity-60"
          >
            {busy ? t("cancelling") : t("cancelYes")}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={busy}
            className="rounded-[10px] border border-line px-4 py-2 text-[13px] font-medium text-ink transition hover:bg-card disabled:opacity-60"
          >
            {t("cancelNo")}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="rounded-[10px] border border-line px-4 py-2 text-[13px] font-medium text-ink transition hover:border-sale hover:text-sale"
          >
            {t("cancelOrder")}
          </button>
          <span className="text-xs text-muted">{t("cancelHint")}</span>
        </div>
      )}
      {error ? <p className="text-sm text-sale">{error}</p> : null}
    </div>
  );
}
