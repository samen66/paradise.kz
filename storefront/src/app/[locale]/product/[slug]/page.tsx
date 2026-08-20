import type { Metadata } from "next";
import { ProductMobileHeader } from "@/components/product/ProductMobileHeader";
import { notFound } from "next/navigation";
import Script from "next/script";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { apiGet, ApiError } from "@/lib/api";
import { tValue } from "@/lib/format";
import type { Product, Category } from "@/lib/types";
import { Breadcrumbs, type Crumb } from "@/components/Breadcrumbs";
import { ProductGallery } from "@/components/ProductGallery";
import { ProductInfo } from "@/components/product/ProductInfo";
import { ProductDescription } from "@/components/product/ProductDescription";
import { ProductCharacteristics } from "@/components/product/ProductCharacteristics";
import { ProductReviews } from "@/components/product/ProductReviews";
import { SimilarProducts } from "@/components/product/SimilarProducts";
import { ShowroomAvailability } from "@/components/product/ShowroomAvailability";
import { ProductShorts } from "@/components/product/ProductShorts";
import { TrustStrip } from "@/components/product/TrustStrip";
import { ProductTabsNav } from "@/components/product/ProductTabsNav";

// ── Data fetching ───────────────────────────────────────────────────────────

async function fetchProduct(slug: string, locale: string): Promise<Product | null> {
  try {
    const response = await apiGet<{ data: Product }>(`/public/products/${slug}`, {
      locale,
      revalidate: 120,
      tags: ["products", `product-${slug}`],
    });

    return response.data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

async function fetchSimilar(productId: number, categoryId: number | null, locale: string): Promise<Product[]> {
  try {
    const params: Record<string, string | number | undefined> = {
      per_page: 4,
      ...(categoryId ? { "filter[category_id]": categoryId } : {}),
    };
    const response = await apiGet<{ data: Product[] }>("/public/products", {
      locale,
      revalidate: 300,
      tags: ["products"],
      searchParams: params,
    });
    // Exclude the current product
    return response.data.filter((p) => p.id !== productId).slice(0, 4);
  } catch {
    return [];
  }
}

async function fetchCategory(categoryId: number | null, locale: string): Promise<Category | null> {
  if (!categoryId) return null;
  try {
    const response = await apiGet<{ data: Category }>(`/public/categories/${categoryId}`, {
      locale,
      revalidate: 300,
      tags: ["categories"],
    });
    return response.data;
  } catch {
    return null;
  }
}

// ── Metadata ────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const product = await fetchProduct(slug, locale);

  if (!product) {
    return {};
  }

  const title = tValue(product.seo_title || product.name, locale);
  const description = tValue(product.seo_description || product.description, locale)?.replace(/<[^>]*>/g, "").slice(0, 160) || undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: product.images[0]?.medium ? [product.images[0].medium] : undefined,
    },
  };
}

// ── Page ────────────────────────────────────────────────────────────────────

export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("product");
  const tCommon = await getTranslations("common");
  const product = await fetchProduct(slug, locale);

  if (!product) {
    notFound();
  }

  // Fetch category breadcrumbs + similar products in parallel
  const [category, similarProducts] = await Promise.all([
    fetchCategory(product.category_id, locale),
    fetchSimilar(product.id, product.category_id, locale),
  ]);

  // Build breadcrumbs from category hierarchy
  const crumbs: Crumb[] = [];
  if (category?.breadcrumb) {
    for (const bc of category.breadcrumb) {
      crumbs.push({ label: tValue(bc.name, locale), href: `/catalog/${bc.slug}` });
    }
  } else if (category) {
    crumbs.push({ label: tValue(category.name, locale), href: `/catalog/${category.slug}` });
  } else {
    crumbs.push({ label: tCommon("catalog"), href: "/catalog" });
  }
  crumbs.push({ label: tValue(product.name, locale) });

  const characteristics = product.characteristics ?? [];
  const brandName = product.brand?.name ?? null;

  // Structured data (JSON-LD)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: tValue(product.name, locale),
    sku: product.article ?? product.code ?? undefined,
    image: product.images.map((image) => image.full),
    description: tValue(product.description, locale)?.replace(/<[^>]*>/g, "") || undefined,
    brand: brandName ? { "@type": "Brand", name: tValue(brandName, locale) } : undefined,
    offers:
      product.price !== null
        ? {
            "@type": "Offer",
            price: product.price,
            priceCurrency: "KZT",
            availability: product.in_stock
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
          }
        : undefined,
  };

  // Plain-text description for the description section (strip HTML if present)
  const descriptionText = tValue(product.description, locale)?.replace(/<[^>]*>/g, "") || null;

  // Category name for sidebar header
  const categoryDisplayName = category ? tValue(category.name, locale) : null;

  return (
    <div className="pb-24 lg:pb-0">
      <Script
        id="product-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Breadcrumbs */}
      <Breadcrumbs items={crumbs} />

      {/* Mobile header (hidden on desktop) */}
      <ProductMobileHeader product={product} />

      {/* ═══ Hero block: Gallery + Sidebar (two-column) ═══ */}
      <div className="mt-3 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] gap-x-14 gap-y-2 lg:gap-y-0 items-start">
        
        {/* Gallery */}
        <div>
          <ProductGallery images={product.images} alt={tValue(product.name, locale)} />

          {/* Trust strip under gallery (desktop only) */}
          <div className="hidden lg:block">
            <TrustStrip />
          </div>
        </div>

        {/* Purchase Sidebar (sticky) */}
        <div className="lg:sticky lg:top-[150px] z-10">
          <ProductInfo product={product} locale={locale} categoryName={categoryDisplayName} />
        </div>
      </div>

      {/* Trust strip (mobile — full width) */}
      <div className="lg:hidden mt-6">
        <TrustStrip />
      </div>

      {/* ═══ Tabs navigation (sticky) ═══ */}
      <div className="mt-10 lg:mt-14">
        <ProductTabsNav 
          reviewCount={product.reviews_count ?? product.reviews?.length}
          hasAbout={!!descriptionText}
          hasSpecs={characteristics.length > 0}
          hasShowrooms={!!(product.showrooms && product.showrooms.length > 0)}
        />
      </div>

      {/* ═══ Content sections (full-width, below hero) ═══ */}
      <div className="mt-8 lg:mt-10 flex flex-col gap-8 lg:gap-10">

        {/* Description */}
        {descriptionText ? (
          <section id="about" className="scroll-mt-[200px]">
            <ProductDescription description={descriptionText} />
          </section>
        ) : null}

        {/* Characteristics */}
        {characteristics.length > 0 ? (
          <section id="specs" className="scroll-mt-[200px]">
            <ProductCharacteristics characteristics={characteristics} />
          </section>
        ) : null}

        {/* Showroom availability */}
        {(product.showrooms && product.showrooms.length > 0) ? (
          <section id="showrooms" className="scroll-mt-[200px]">
            <ShowroomAvailability showrooms={product.showrooms} />
          </section>
        ) : null}

        {/* Reviews — component already has id="reviews" internally */}
        <div className="scroll-mt-[200px]">
          <ProductReviews product={product} />
        </div>
      </div>

      {/* Video Shorts */}
      {(product.shorts && product.shorts.length > 0) ? (
        <div className="mt-14">
          <ProductShorts shorts={product.shorts} />
        </div>
      ) : null}

      {/* Similar products */}
      {similarProducts.length > 0 ? (
        <div className="mt-8">
          <SimilarProducts products={similarProducts} />
        </div>
      ) : null}
    </div>
  );
}
