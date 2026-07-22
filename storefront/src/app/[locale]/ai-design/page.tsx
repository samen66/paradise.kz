import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { AiDesignClient } from "@/components/ai-design/AiDesignClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });

  return {
    title: t("aiDesignTitle"),
    description: t("aiDesignText"),
  };
}

export default function AiDesignPage() {
  return (
    <Suspense fallback={<div className="fixed inset-0 z-50 bg-[#faf8f5]" />}>
      <AiDesignClient />
    </Suspense>
  );
}
