"use client";

import { useTranslations } from "next-intl";
import { isCancelled, orderStepIndex, orderSteps } from "@/lib/order-status";

/**
 * The placed → confirmed → on its way → received track for one order.
 * A cancelled order gets a notice instead of the track.
 */
export function OrderProgress({
  status,
  deliveryMethod,
}: {
  status: string;
  deliveryMethod: "pickup" | "delivery";
}) {
  const t = useTranslations("account");

  if (isCancelled(status)) {
    return (
      <div className="rounded-2xl border border-sale/30 bg-sale/5 px-5 py-4">
        <p className="font-semibold text-sale">{t("cancelledTitle")}</p>
        <p className="mt-1 text-sm text-muted">{t("cancelledText")}</p>
      </div>
    );
  }

  const steps = orderSteps(deliveryMethod);
  const current = orderStepIndex(status);

  return (
    <ol className="flex flex-col sm:grid sm:grid-cols-4">
      {steps.map((step, index) => {
        const reached = index <= current;
        const isCurrent = index === current;

        return (
          <li key={step} className="relative flex items-center gap-3 py-1.5 sm:flex-col sm:gap-2 sm:py-0 sm:text-center">
            {index > 0 ? (
              <span
                aria-hidden="true"
                className={`absolute bottom-1/2 left-[11px] h-full w-0.5 sm:top-[11px] sm:right-1/2 sm:bottom-auto sm:left-auto sm:h-0.5 sm:w-full ${index <= current ? "bg-ink" : "bg-line"}`}
              />
            ) : null}
            <span
              className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold ${
                reached ? "border-ink bg-ink text-ink-inverse" : "border-line bg-surface text-muted"
              } ${isCurrent ? "ring-4 ring-ink/10" : ""}`}
            >
              {reached && !isCurrent ? (
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2.4} className="h-3 w-3" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m3.5 8.5 3 3 6-7" />
                </svg>
              ) : (
                index + 1
              )}
            </span>
            <span
              aria-current={isCurrent ? "step" : undefined}
              className={`text-sm leading-tight sm:px-1 sm:text-xs ${isCurrent ? "font-semibold text-ink" : reached ? "text-ink" : "text-muted"}`}
            >
              {t(`steps.${step}`)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
