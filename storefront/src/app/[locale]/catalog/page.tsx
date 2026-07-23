import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CatalogView, type CatalogSearchParams } from "@/components/CatalogView";
import { CategoryIcons } from "@/components/CategoryIcons";
import { apiGet } from "@/lib/api";
import type { Category } from "@/lib/types";

async function fetchRootCategories(locale: string): Promise<Category[]> {
  try {
    const response = await apiGet<{ data: Category[] }>("/public/categories", {
      locale,
      revalidate: 300,
    });
    return response.data;
  } catch {
    return [];
  }
}

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
  const rootCategories = await fetchRootCategories(locale);

  return (
    <div>
      <Breadcrumbs items={[{ label: t("title") }]} />
      {rootCategories.length > 0 ? (
        <div className="mb-4">
          <CategoryIcons categories={rootCategories} />
        </div>
      ) : null}
      <CatalogView
        locale={locale}
        searchParams={await searchParams}
        pathname="/catalog"
        title={t("title")}
        subcategories={rootCategories}
      />
    </div>
  );
}
