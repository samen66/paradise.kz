import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ShowroomsClient } from "./ShowroomsClient";

export default async function ShowroomsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="min-h-screen bg-surface font-sans">
      <div className="mx-auto max-w-[1360px] px-8 pt-5">
        <nav aria-label="Хлебные крошки" className="text-[13px] text-muted">
          <Link href="/" className="text-muted no-underline hover:text-ink">Главная</Link>
          <span className="mx-[7px]">›</span>
          <span className="font-medium text-ink">Шоурумы</span>
        </nav>
      </div>

      <ShowroomsClient />
    </div>
  );
}
