import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Category, Settings } from "@/lib/types";
import { SearchBox } from "./SearchBox";
import { CartBadge } from "./CartBadge";
import { AccountLink } from "./AccountLink";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { ThemeToggle } from "./ThemeToggle";
import { MegaMenu } from "./MegaMenu";
import { HeaderBurger } from "./HeaderBurger";

export async function Header({
  categories,
  settings,
}: {
  categories: Category[];
  settings: Settings | null;
}) {
  const t = await getTranslations("common");
  const tNav = await getTranslations("nav");
  const tAccount = await getTranslations("account");
  const rootCategories = categories.filter((category) => category.parent_id === null);
  const phone = settings?.contacts.phone;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur-md">
      <div className="hidden bg-surface text-xs text-muted sm:block">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-2 sm:px-6 lg:px-10">
          <div className="flex gap-4">
            <Link href="/about" className="hover:text-ink transition">{tNav("about")}</Link>
            <Link href="/delivery" className="hover:text-ink transition">{tNav("delivery")}</Link>
            <Link href="/contacts" className="hover:text-ink transition">{tNav("contacts")}</Link>
            <a href="/login" className="font-medium text-ink hover:opacity-70 transition">Стать партнером</a>
          </div>
          <div className="flex items-center gap-4">
            <span className="truncate">{settings?.contacts.address ?? ""}</span>
            {phone ? (
              <a href={`tel:${phone.replace(/[^+\d]/g, "")}`} className="font-medium text-ink">
                {phone}
              </a>
            ) : null}
            <ThemeToggle />
            <LocaleSwitcher />
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1400px] grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 py-4 sm:px-6 lg:px-10">
        <div className="flex items-center gap-3">
          <HeaderBurger categories={categories} settings={settings} />
          <div className="hidden w-full max-w-xs md:block">
            <Suspense fallback={<div className="h-10" />}>
              <SearchBox />
            </Suspense>
          </div>
        </div>

        <Link
          href="/"
          className="justify-self-center font-display text-2xl font-semibold tracking-tight text-ink"
        >
          {t("storeName")}
        </Link>

        <div className="flex items-center justify-end gap-3 sm:gap-4">
          <AccountLink />
          <Link
            href="/account/favorites"
            aria-label={tAccount("favorites")}
            className="flex items-center gap-2 text-sm font-medium text-ink transition hover:opacity-70"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true" className="h-6 w-6">
              <path d="M12 20s-7-4.35-9.5-8.5C1 8.5 2.5 5.5 5.5 5.5c1.9 0 3.2 1.1 4 2.2.8-1.1 2.1-2.2 4-2.2 3 0 4.5 3 3 6C19 15.65 12 20 12 20Z" />
            </svg>
            <span className="hidden lg:inline">{tAccount("favorites")}</span>
          </Link>
          <CartBadge />
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] px-4 pb-3 md:hidden">
        <Suspense fallback={<div className="h-10" />}>
          <SearchBox />
        </Suspense>
      </div>

      {rootCategories.length > 0 ? (
        <nav className="border-t border-line hidden md:flex items-center justify-between gap-6 relative">
          <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10 flex-1 flex items-center justify-between gap-6 w-full">
            <MegaMenu categories={rootCategories} />
            <div className="flex items-center gap-1 flex-shrink-0">
              <Link
                href="/showrooms"
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-ink transition hover:bg-surface"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 21s7-6.4 7-11a7 7 0 10-14 0c0 4.6 7 11 7 11z" stroke="#c8372f" strokeWidth={2} />
                  <circle cx="12" cy="10" r="2.4" fill="#c8372f" />
                </svg>
                {tNav("showrooms")}
              </Link>
              <Link
                href="/ai-design"
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-ink transition hover:opacity-80"
                style={{ background: "linear-gradient(135deg, rgba(200,55,47,0.10), rgba(232,137,79,0.12))" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 3l1.9 4.9L19 9.8l-4.1 3 1.4 5.2L12 15.4 7.7 18l1.4-5.2L5 9.8l5.1-1.9L12 3z" fill="#c8372f" />
                </svg>
                {tNav("aiDesign")}
              </Link>
              <Link
                href="/shorts"
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-ink transition hover:bg-surface"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M8 5v14l11-7z" fill="#c8372f" />
                </svg>
                {tNav("shorts")}
              </Link>
            </div>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
