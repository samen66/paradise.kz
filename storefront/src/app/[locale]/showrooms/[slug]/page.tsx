import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { showroomBySlug } from "@/lib/showroom-data";
import { ShowroomClient } from "./ShowroomClient";

export default async function ShowroomPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const showroom = showroomBySlug(slug);
  if (!showroom) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-surface font-sans">
      <div className="mx-auto max-w-[1360px] px-8 pt-5">
        <nav aria-label="Хлебные крошки" className="text-[13px] text-muted">
          <Link href="/" className="text-muted no-underline hover:text-ink">Главная</Link>
          <span className="mx-[7px]">›</span>
          <Link href="/showrooms" className="text-muted no-underline hover:text-ink">Шоурумы</Link>
          <span className="mx-[7px]">›</span>
          <span className="font-medium text-ink">{showroom.name}</span>
        </nav>
      </div>

      <ShowroomClient showroom={showroom} />
    </div>
  );
}
