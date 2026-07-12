"use client";

import { Suspense, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";

function SuccessContent() {
  const t = useTranslations("checkout");
  const tCommon = useTranslations("common");
  const searchParams = useSearchParams();
  const [number, setNumber] = useState<string | null>(null);

  useEffect(() => {
    const fromQuery = searchParams.get("number");
    if (fromQuery) {
      setNumber(fromQuery);
      return;
    }
    try {
      const stored = sessionStorage.getItem("last-order");
      if (stored) {
        setNumber((JSON.parse(stored) as { number?: string }).number ?? null);
      }
    } catch {
      // sessionStorage unavailable — the generic message still renders.
    }
  }, [searchParams]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center sm:py-24">
      <div className="w-full rounded-2xl bg-panel px-6 py-10 sm:px-10 sm:py-12">
        <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-mint text-mint-ink">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="h-7 w-7"
          >
            <path d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          {t("successTitle")}
        </h1>

        {number ? (
          <p className="mt-4 inline-block rounded-full border border-line-strong bg-white px-4 py-1.5 text-sm font-semibold text-ink">
            {t("successNumber", { number })}
          </p>
        ) : null}

        <p className="mt-4 text-sm text-muted">{t("successText")}</p>
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/order-tracking"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-line-strong bg-white px-6 py-3.5 text-sm font-medium text-ink transition hover:border-ink"
        >
          {t("trackOrder")}
        </Link>
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-ink px-6 py-3.5 text-sm font-medium text-white transition hover:bg-ink-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          {tCommon("backHome")}
        </Link>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  // useSearchParams needs a Suspense boundary for static prerendering.
  return (
    <Suspense fallback={null}>
      <SuccessContent />
    </Suspense>
  );
}
