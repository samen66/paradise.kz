import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { apiGet, ApiError } from "@/lib/api";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { tValue } from "@/lib/format";
import { CatalogView, type CatalogSearchParams } from "@/components/CatalogView";
import { Link } from "@/i18n/navigation";
import type { Category } from "@/lib/types";

async function fetchCategory(slug: string, locale: string): Promise<Category | null> {
  try {
    const response = await apiGet<{ data: Category }>(`/public/categories/${slug}`, {
      locale,
      revalidate: 300,
    });

    return response.data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const category = await fetchCategory(slug, locale);

  if (!category) {
    return {};
  }

  return {
    title: tValue(category.seo_title, locale) || tValue(category.name, locale),
    description: tValue(category.seo_description, locale) || undefined,
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<CatalogSearchParams>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("catalog");
  const tCommon = await getTranslations("common");
  const category = await fetchCategory(slug, locale);

  if (!category) {
    notFound();
  }

  const ancestors = (category.breadcrumb ?? []).slice(0, -1);

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: t("title"), href: "/catalog" },
          ...ancestors.map((ancestor) => ({
            label: tValue(ancestor.name, locale),
            href: `/catalog/${ancestor.slug}`,
          })),
          { label: tValue(category.name, locale) },
        ]}
      />

      <CatalogView
        locale={locale}
        searchParams={await searchParams}
        categorySlug={slug}
        pathname={`/catalog/${slug}`}
        title={tValue(category.name, locale)}
        seoDescription={tValue(category.seo_description, locale)}
        subcategories={category.children}
      />
    </div>
  );
}
