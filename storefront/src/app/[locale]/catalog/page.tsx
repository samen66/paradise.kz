import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CatalogView, type CatalogSearchParams } from "@/components/CatalogView";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "catalog" });

  return { title: t("title") };
}

export default async function CatalogPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<CatalogSearchParams>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("catalog");
  const tCommon = await getTranslations("common");

  return (
    <div>
      <Breadcrumbs items={[{ label: t("title") }]} />
      <CatalogView
        locale={locale}
        searchParams={await searchParams}
        pathname="/catalog"
        title={t("title")}
      />
    </div>
  );
}
