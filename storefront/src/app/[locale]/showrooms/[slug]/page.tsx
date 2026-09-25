import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AddToCartButton } from "@/components/AddToCartButton";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Pagination } from "@/components/Pagination";
import { ProductCard } from "@/components/ProductCard";
import { Link } from "@/i18n/navigation";
import { ApiError, apiGet } from "@/lib/api";
import type { Paginated, Product, Showroom } from "@/lib/types";
import { ShowroomClient } from "./ShowroomClient";

type Params = Promise<{ locale: string; slug: string }>;

async function fetchShowroom(slug: string, locale: string): Promise<Showroom | null> {
  try {
    const response = await apiGet<{ data: Showroom }>(`/public/showrooms/${encodeURIComponent(slug)}`, {
      locale,
      tags: ["showrooms", `showroom:${slug}`],
    });
    return response.data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  const showroom = await fetchShowroom(slug, locale);

  return showroom ? { title: showroom.name, description: showroom.address ?? undefined } : {};
}

export default async function ShowroomPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("showrooms");

  const showroom = await fetchShowroom(slug, locale);
  if (!showroom) {
    notFound();
  }

  const { page } = await searchParams;
  const products = await apiGet<Paginated<Product>>("/public/products", {
    locale,
    tags: ["products", `showroom:${slug}`],
    searchParams: { store_id: showroom.id, "filter[in_stock]": 1, page },
  });

  return (
    <div className="min-h-screen bg-surface font-sans">
      <div className="mx-auto max-w-[1360px] px-4 pt-5 sm:px-8">
        <Breadcrumbs items={[{ label: t("breadcrumb"), href: "/showrooms" }, { label: showroom.name }]} />
      </div>

      <ShowroomClient showroom={showroom} />

      <section className="mx-auto max-w-[1360px] px-4 pb-14 sm:px-8">
        <h2 className="m-0 mb-1.5 font-display text-2xl font-bold tracking-tight text-ink">
          {t("productsTitle")} <span className="text-base font-medium text-muted">· {products.meta.total}</span>
        </h2>
        <p className="m-0 mb-5 text-sm text-muted">{t("productsHint")}</p>

        {products.data.length === 0 ? (
          <div className="rounded-2xl border border-line bg-white p-10 text-center text-muted">{t("noProducts")}</div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(232px,1fr))] items-start gap-[22px]">
            {products.data.map((product) => (
              <div key={product.id} className="flex flex-col gap-2">
                <ProductCard product={product} showOverlay={false} showAddToCart={false} />
                <AddToCartButton product={product} />
              </div>
            ))}
          </div>
        )}

        <div className="mt-9 flex flex-col items-center gap-6">
          <Pagination meta={products.meta} pathname={`/showrooms/${slug}`} searchParams={{ page }} />
          <Link href="/showrooms" className="inline-flex items-center rounded-xl border border-line bg-white px-[22px] py-3 text-sm font-semibold text-ink no-underline hover:border-ink/30">
            {t("allShowrooms")}
          </Link>
        </div>
      </section>
    </div>
  );
}
