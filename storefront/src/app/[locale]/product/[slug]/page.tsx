import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { apiGet, ApiError } from "@/lib/api";
import { formatPrice, tValue } from "@/lib/format";
import type { Product } from "@/lib/types";
import { AddToCartButton } from "@/components/AddToCartButton";
import { FavoriteButton } from "@/components/FavoriteButton";
import { Breadcrumbs, type Crumb } from "@/components/Breadcrumbs";
import { ProductGallery } from "@/components/ProductGallery";

async function fetchProduct(slug: string, locale: string): Promise<Product | null> {
  try {
    const response = await apiGet<{ data: Product }>(`/public/products/${slug}`, {
      locale,
      revalidate: 120,
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
  const product = await fetchProduct(slug, locale);

  if (!product) {
    return {};
  }

  return {
    title: tValue(product.name, locale),
    description: tValue(product.description, locale)?.replace(/<[^>]*>/g, "").slice(0, 160) || undefined,
    openGraph: {
      title: tValue(product.name, locale),
      images: product.images[0]?.medium ? [product.images[0].medium] : undefined,
    },
  };
}

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

  const crumbs: Crumb[] = [{ label: tCommon("catalog"), href: "/catalog" }, { label: tValue(product.name, locale) }];

  const characteristics = product.characteristics ?? [];
  const variants = product.variants ?? [];
  const hasBelowContent = variants.length > 0 || characteristics.length > 0 || Boolean(product.description);
  const brandName = product.brand?.name ?? null;

  const metaBadges = [
    product.article ? { key: "article", label: t("article"), value: product.article } : null,
    product.code ? { key: "code", label: t("code"), value: product.code } : null,
    brandName ? { key: "brand", label: t("brand"), value: brandName } : null,
    product.country ? { key: "country", label: t("country"), value: product.country } : null,
  ].filter((badge): badge is { key: string; label: string; value: string } => badge !== null);

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

  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Breadcrumbs items={crumbs} />

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <ProductGallery images={product.images} alt={product.name} />

        <div className="lg:sticky lg:top-4 lg:self-start">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl lg:text-[34px] leading-tight">
            {tValue(product.name, locale)}
          </h1>

          {metaBadges.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {metaBadges.map((badge) => (
                <span
                  key={badge.key}
                  className="inline-block rounded-full bg-black/5 px-2.5 py-1 text-xs text-muted"
                >
                  {badge.label}: {badge.value}
                </span>
              ))}
            </div>
          ) : null}

          <p className="mt-4 text-2xl font-semibold text-ink">{formatPrice(product.price, locale)}</p>

          <p className="mt-2 flex items-center gap-1.5 text-sm font-medium">
            <span
              aria-hidden="true"
              className={`h-2 w-2 rounded-full ${product.in_stock ? "bg-mint-ink" : "bg-muted"}`}
            />
            <span className={product.in_stock ? "text-mint-ink" : "text-muted"}>
              {product.in_stock ? tCommon("inStock") : tCommon("outOfStock")}
            </span>
            {product.in_stock && product.stock !== undefined ? (
              <span className="text-muted">· {product.stock}</span>
            ) : null}
          </p>

          <div className="mt-6 flex items-center gap-3">
            <div className="flex-1">
              {product.in_stock ? <AddToCartButton product={product} /> : null}
            </div>
            <FavoriteButton productId={product.id} />
          </div>
        </div>
      </div>

      {hasBelowContent ? (
        <div className="mt-12 max-w-[720px] space-y-10 lg:mt-16">
          {variants.length > 0 ? (
            <section>
              <h2 className="font-display text-xl font-semibold text-ink sm:text-2xl">{t("variants")}</h2>
              <div className="mt-5 flex flex-wrap gap-2">
                {variants.map((variant) => (
                  <span
                    key={variant.id}
                    className={`rounded-full border border-line bg-white px-4 py-2 text-sm transition ${
                      variant.in_stock ? "text-ink hover:border-ink" : "text-muted opacity-60"
                    }`}
                  >
                    {tValue(variant.name, locale)}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          {characteristics.length > 0 ? (
            <section>
              <h2 className="font-display text-xl font-semibold text-ink sm:text-2xl">
                {t("characteristics")}
              </h2>
              <dl className="mt-5 divide-y divide-line text-sm">
                {characteristics.map((characteristic) => (
                  <div key={characteristic.slug} className="flex justify-between gap-4 py-2.5">
                    <dt className="text-muted">{tValue(characteristic.name, locale)}</dt>
                    <dd className="text-right font-medium text-ink">{tValue(characteristic.value, locale)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          {product.description ? (
            <section>
              <h2 className="font-display text-xl font-semibold text-ink sm:text-2xl">{t("description")}</h2>
              <div
                className="mt-5 text-sm leading-relaxed text-ink [&_a]:text-ink [&_a]:underline [&_a]:underline-offset-4 [&_li]:mb-1 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_p:last-child]:mb-0 [&_p]:mb-3 [&_strong]:font-semibold [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5"
                dangerouslySetInnerHTML={{ __html: tValue(product.description, locale) }}
              />
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
