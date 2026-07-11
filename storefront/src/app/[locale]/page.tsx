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

  const t = await getTranslations("common");
  const [home, categories] = await Promise.all([
    apiGet<{ data: HomeData }>("/public/home", { locale, revalidate: 300 }),
    apiGet<{ data: Category[] }>("/public/categories", { locale, revalidate: 300 }),
  ]);
  const rootCategories = categories.data.filter((category) => category.parent_id === null);

  return (
    <div className="space-y-14 sm:space-y-16">
      <BannerCarousel banners={home.data.banners} />

      {rootCategories.length > 0 ? (
        <section>
          <div className="mb-6 flex items-baseline justify-between">
            <h2 className="font-display text-2xl font-semibold text-ink sm:text-3xl">Каталог</h2>
            <Link href="/catalog" className="text-sm font-medium text-ink hover:text-ink/70">
              Смотреть все →
            </Link>
          </div>
          <CategoryIcons categories={rootCategories} />
        </section>
      ) : null}

      {home.data.collections.map((collection) => (
        <section key={collection.id}>
          <div className="mb-6 flex items-baseline justify-between">
            <h2 className="font-display text-2xl font-semibold text-ink sm:text-3xl">{collection.title}</h2>
            <Link
              href="/catalog"
              className="text-sm font-medium text-ink hover:text-ink/70"
            >
              Смотреть все →
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

      <section className="rounded-3xl bg-surface px-6 py-12 sm:p-16 text-center max-w-4xl mx-auto">
        <h2 className="font-display text-2xl sm:text-3xl font-semibold text-ink mb-4">Paradise.kz — гипермаркет мебели</h2>
        <p className="text-muted leading-relaxed">
          Мы предлагаем стильную и надежную мебель для вашего дома. Наша цель — сделать процесс обустройства интерьера простым и приятным.
          Сотни товаров всегда в наличии на наших складах в Казахстане. Откройте для себя новые коллекции для гостиной, спальни и кухни.
        </p>
      </section>
    </div>
  );
}
