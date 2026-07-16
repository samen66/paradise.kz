import { getTranslations, setRequestLocale } from "next-intl/server";
import { apiGet } from "@/lib/api";
import type { Category, HomeData } from "@/lib/types";
import { BannerCarousel } from "@/components/BannerCarousel";
import { CategoryIcons } from "@/components/CategoryIcons";
import { Carousel } from "@/components/Carousel";
import { ProductCard } from "@/components/ProductCard";
import { Link } from "@/i18n/navigation";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const tHome = await getTranslations("home");
  const [home, categories] = await Promise.all([
    apiGet<{ data: HomeData }>("/public/home", { locale, revalidate: 300 }),
    apiGet<{ data: Category[] }>("/public/categories", { locale, revalidate: 300 }),
  ]);
  const rootCategories = categories.data.filter((category) => category.parent_id === null);

  return (
    <div className="space-y-14 sm:space-y-16">
      <div className="bg-panel rounded-3xl p-6 sm:p-10 mb-10 -mt-4">
        <BannerCarousel banners={home.data.banners} />

        {rootCategories.length > 0 ? (
          <section className="mt-10">
            <div className="mb-6 flex items-baseline justify-between">
              <h2 className="font-display text-2xl font-semibold text-ink sm:text-3xl">{tHome("catalog")}</h2>
              <Link href="/catalog" className="text-sm font-medium text-ink hover:text-ink/70">
                {tHome("viewAll")}
              </Link>
            </div>
            <CategoryIcons categories={rootCategories} />
          </section>
        ) : null}
      </div>

      {home.data.collections.map((collection) => (
        <section key={collection.id}>
          <div className="mb-6 flex items-baseline justify-between">
            <h2 className="font-display text-2xl font-semibold text-ink sm:text-3xl">{collection.title}</h2>
            <Link
              href="/catalog"
              className="text-sm font-medium text-ink hover:text-ink/70"
            >
              {tHome("viewAll")}
            </Link>
          </div>
          <Carousel>
            {collection.products.map((product) => (
              <div key={product.id} className="w-[calc(60vw)] sm:w-[calc(40vw)] lg:w-[calc(25%-15px)] flex-shrink-0 snap-start">
                <ProductCard product={product} />
              </div>
            ))}
          </Carousel>
        </section>
      ))}

      <section className="rounded-3xl bg-surface px-6 py-12 sm:p-16 text-center max-w-4xl mx-auto shadow-sm border border-line">
        <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink mb-4 tracking-tight">{tHome("heroTitle")}</h2>
        <p className="text-ink/80 leading-relaxed max-w-[700px] mx-auto mb-8 font-medium">
          {tHome("heroText")}
        </p>
        <Link href="/catalog" className="inline-block bg-ink text-white px-6 py-3 rounded-xl font-medium hover:bg-ink/90 transition-colors">
          {tHome("goToCatalog")}
        </Link>
      </section>
    </div>
  );
}
