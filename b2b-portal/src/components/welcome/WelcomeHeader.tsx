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

/**
 * Fits one line at 375px: a guest sees the logo plus "Войти" and "Стать
 * партнёром", so on phones the logo and buttons shrink and never wrap.
 */
export function WelcomeHeader() {
  const t = useTranslations("welcome");
  const signedIn = useSignedIn();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 py-4 sm:gap-4 sm:px-6 lg:px-10">
        <Link href="/" className="whitespace-nowrap font-display text-lg font-semibold tracking-tight text-ink sm:text-2xl">
          Paradise B2B
        </Link>
        <nav className="flex shrink-0 items-center gap-1 sm:gap-4">
          {!signedIn && (
            <Link href="/login" className="whitespace-nowrap rounded-full px-3 py-2 text-xs font-medium text-ink transition hover:bg-surface sm:px-4 sm:text-sm">
              {t("login")}
            </Link>
          )}
          <PartnerLink className="whitespace-nowrap rounded-full bg-ink px-3 py-2 text-xs font-medium text-white transition hover:bg-ink-hover sm:px-5 sm:text-sm" />
        </nav>
      </div>
    </header>
  );
}
