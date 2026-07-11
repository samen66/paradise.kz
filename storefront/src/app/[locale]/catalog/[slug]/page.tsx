import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { apiGet, ApiError } from "@/lib/api";
import type { Category } from "@/lib/types";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CatalogView, type CatalogSearchParams } from "@/components/CatalogView";
import { Link } from "@/i18n/navigation";

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
    title: category.seo_title ?? category.name,
    description: category.seo_description ?? undefined,
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
          { label: tCommon("home"), href: "/" },
          { label: t("title"), href: "/catalog" },
          ...ancestors.map((ancestor) => ({
            label: ancestor.name,
            href: `/catalog/${ancestor.slug}`,
          })),
          { label: category.name },
        ]}
      />

      {(category.children ?? []).length > 0 ? (
        <div className="mb-6 flex flex-wrap gap-2">
          {category.children!.map((child) => (
            <Link
              key={child.id}
              href={`/catalog/${child.slug}`}
              className="rounded-full border border-line bg-white px-4 py-2 text-sm text-ink transition hover:border-ink"
            >
              {child.name}
            </Link>
          ))}
        </div>
      ) : null}

      <CatalogView
        locale={locale}
        searchParams={await searchParams}
        categorySlug={slug}
        pathname={`/catalog/${slug}`}
        title={category.name}
        seoDescription={category.seo_description}
      />
    </div>
  );
}
