import { Suspense } from "react";
import { ShortsFeed } from "@/components/shorts/ShortsFeed";
import { getTranslations } from "next-intl/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });

  return {
    title: t("shortsTitle"),
    description: t("shortsText"),
  };
}

export default function ShortsPage() {
  return (
    <Suspense fallback={<div className="fixed inset-0 z-50 bg-[#0b0a09]" />}>
      <ShortsFeed />
    </Suspense>
  );
}
