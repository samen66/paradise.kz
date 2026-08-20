// Original home page preserved in _page_home_backup.tsx — do not delete
import { getTranslations, setRequestLocale } from "next-intl/server";
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

export default async function HomePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<CatalogSearchParams>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("catalog");
  const rootCategories = await fetchRootCategories(locale);

  return (
    <div>
      {rootCategories.length > 0 ? (
        <div className="mb-4">
          <CategoryIcons categories={rootCategories} />
        </div>
      ) : null}
      <CatalogView
        locale={locale}
        searchParams={await searchParams}
        pathname="/"
        title={t("title")}
        subcategories={rootCategories}
      />
    </div>
  );
}
