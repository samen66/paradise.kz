"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";

export function SearchBox() {
  const t = useTranslations("common");
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();

  return (
    <form
      className="relative w-full"
      onSubmit={(event) => {
        event.preventDefault();
        const query = new FormData(event.currentTarget).get("q");
        router.push(`/search?q=${encodeURIComponent(String(query ?? ""))}`, { locale });
      }}
    >
      <button
        type="submit"
        aria-label={t("searchButton")}
        className="absolute left-0 top-0 grid h-full w-11 place-items-center text-muted transition hover:text-ink"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true" className="h-5 w-5">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      </button>
      <input
        type="search"
        name="q"
        defaultValue={searchParams.get("q") ?? ""}
        placeholder={t("search")}
        className="w-full rounded-full border border-line bg-surface py-2.5 pl-11 pr-4 text-sm text-ink placeholder:text-muted outline-none focus:border-line-strong focus:bg-white"
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            const query = e.currentTarget.value;
            if (query.trim()) {
              router.push(`/search?q=${encodeURIComponent(query)}`, { locale });
            }
          }
        }}
      />
    </form>
  );
}
