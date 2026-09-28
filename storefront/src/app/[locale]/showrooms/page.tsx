import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { apiGet } from "@/lib/api";
import type { Settings, Showroom } from "@/lib/types";
import { ShowroomsClient } from "./ShowroomsClient";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "showrooms" });

  return { title: t("title"), description: t("lead") };
}

export default async function ShowroomsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("showrooms");

  const [showrooms, settings] = await Promise.all([
    apiGet<{ data: Showroom[] }>("/public/showrooms", { locale, tags: ["showrooms"] }),
    apiGet<{ data: Settings }>("/public/settings", { locale }),
  ]);

  return (
    <div className="min-h-screen bg-surface font-sans">
      <div className="mx-auto max-w-[1360px] px-4 pt-5 sm:px-8">
        <Breadcrumbs items={[{ label: t("breadcrumb") }]} />
      </div>
      <ShowroomsClient showrooms={showrooms.data} contactPhone={settings.data.contacts.phone} />
    </div>
  );
}
