import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Category, Settings } from "@/lib/types";
import { SearchBox } from "./SearchBox";
import { CartBadge } from "./CartBadge";
import { AccountLink } from "./AccountLink";
import { LocaleSwitcher } from "./LocaleSwitcher";
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
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur-md">
      <div className="hidden bg-surface text-xs text-muted sm:block">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-2 sm:px-6 lg:px-10">
          <div className="flex gap-4">
            <Link href="/about" className="hover:text-ink transition">{tNav("about")}</Link>
            <Link href="/delivery" className="hover:text-ink transition">{tNav("delivery")}</Link>
            <Link href="/contacts" className="hover:text-ink transition">{tNav("contacts")}</Link>
            <a href="/b2b/login" className="font-medium text-ink hover:opacity-70 transition">Стать партнером</a>
          </div>
          <div className="flex items-center gap-4">
            <span className="truncate">{settings?.contacts.address ?? ""}</span>
            {phone ? (
              <a href={`tel:${phone.replace(/[^+\d]/g, "")}`} className="font-medium text-ink">
                {phone}
              </a>
            ) : null}
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
        <nav className="border-t border-line hidden md:block relative">
          <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
            <MegaMenu categories={rootCategories} />
          </div>
        </nav>
      ) : null}
    </header>
  );
}
