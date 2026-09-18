"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useSignedIn } from "./useSignedIn";

/** Guest: "Стать партнёром" → /register. Signed in: "Перейти в каталог". */
export function PartnerLink({ className }: { className: string }) {
  const t = useTranslations("welcome");
  const signedIn = useSignedIn();

  return signedIn ? (
    <Link href="/catalog" className={className}>{t("toCatalog")}</Link>
  ) : (
    <Link href="/register" className={className}>{t("becomePartner")}</Link>
  );
}

export function WelcomeHeader() {
  const t = useTranslations("welcome");
  const signedIn = useSignedIn();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-10">
        <Link href="/" className="font-display text-2xl font-semibold tracking-tight text-ink">
          Paradise B2B
        </Link>
        <nav className="flex items-center gap-2 sm:gap-4">
          {!signedIn && (
            <Link href="/login" className="rounded-full px-4 py-2 text-sm font-medium text-ink transition hover:bg-surface">
              {t("login")}
            </Link>
          )}
          <PartnerLink className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-white transition hover:bg-ink-hover" />
        </nav>
      </div>
    </header>
  );
}
