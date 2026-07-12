import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("common");

  return (
    <div className="mx-auto max-w-md py-16 text-center sm:py-24">
      <p className="mb-3 text-sm font-medium tracking-[0.2em] text-muted uppercase">404</p>
      <h1 className="mb-3 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl lg:text-[34px] leading-tight">
        {t("notFound")}
      </h1>
      <p className="mb-8 text-muted">{t("notFoundText")}</p>
      <Link
        href="/"
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-ink px-6 py-3.5 text-sm font-medium text-white transition hover:bg-ink-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        {t("backHome")}
      </Link>
    </div>
  );
}
