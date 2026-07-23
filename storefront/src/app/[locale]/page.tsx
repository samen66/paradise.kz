import { getTranslations, setRequestLocale } from "next-intl/server";
import { apiGet } from "@/lib/api";
import type { Category, HomeData } from "@/lib/types";
import { BannerCarousel } from "@/components/BannerCarousel";
import { CategoryIcons } from "@/components/CategoryIcons";
import { Carousel } from "@/components/Carousel";
import { ProductCard } from "@/components/ProductCard";
import { Link } from "@/i18n/navigation";
import NextLink from "next/link";

const SHORTS_PREVIEWS = [
  { id: 1, seed: "sofa-milan-reel", labelKey: "Диван Milan прямой" },
  { id: 2, seed: "kitchen-nordic-reel", labelKey: "Кухня в сканди стиле" },
  { id: 3, seed: "bedroom-cozy-reel", labelKey: "Кровать Bergen" },
  { id: 4, seed: "office-chair-reel", labelKey: "Кресло Oslo" },
  { id: 5, seed: "wardrobe-reel", labelKey: "Шкаф-купе Lund" },
];

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
      <BannerCarousel banners={home.data.banners} />

      {rootCategories.length > 0 ? (
        <section>
          <h2 className="font-display text-2xl font-semibold text-ink sm:text-3xl mb-6">{tHome("categories")}</h2>
          <CategoryIcons categories={rootCategories} />
        </section>
      ) : null}

      <Link
        href="/ai-design"
        className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr] overflow-hidden rounded-[22px] bg-inverse shadow-[0_1px_2px_rgba(28,26,23,0.04),0_18px_44px_rgba(28,26,23,0.10)]"
      >
        <div className="flex flex-col justify-center gap-3 px-8 py-9 sm:px-10 text-ink-inverse">
          <span
            className="inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white"
            style={{ background: "linear-gradient(135deg,#c8372f,#e8894f)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 3l1.9 4.9L19 9.8l-4.1 3 1.4 5.2L12 15.4 7.7 18l1.4-5.2L5 9.8l5.1-1.9L12 3z" fill="#fff" />
            </svg>
            {tHome("aiDesignBadge")}
          </span>
          <h2 className="font-display text-2xl sm:text-3xl font-extrabold leading-tight tracking-tight">
            {tHome("aiDesignTitle")}
          </h2>
          <p className="max-w-[460px] text-[15px] leading-relaxed opacity-70">{tHome("aiDesignText")}</p>
          <span className="mt-2 inline-flex w-fit items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-ink">
            {tHome("aiDesignCta")} →
          </span>
        </div>
        <div
          className="min-h-[220px] bg-cover bg-center"
          style={{ backgroundImage: "url(https://picsum.photos/seed/ai-hero-interior/900/600)" }}
        />
      </Link>

      <section className="rounded-2xl border border-line bg-card p-5 sm:p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[11px]"
              style={{ background: "linear-gradient(135deg,#c8372f,#e8894f)" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M8 5v14l11-7z" fill="#fff" />
              </svg>
            </span>
            <div>
              <h2 className="font-display text-xl font-semibold text-ink sm:text-2xl">{tHome("shortsTitle")}</h2>
              <p className="mt-0.5 text-[13px] text-muted">{tHome("shortsText")}</p>
            </div>
          </div>
          <Link href="/shorts" className="flex-shrink-0 text-sm font-semibold text-red-600 hover:opacity-80">
            {tHome("shortsViewAll")} →
          </Link>
        </div>
        <div className="flex gap-5 overflow-x-auto pb-1 [scrollbar-width:thin]">
          {SHORTS_PREVIEWS.map((s) => (
            <NextLink
              key={s.id}
              href={`/shorts?reel=${s.id}`}
              className="flex w-24 flex-shrink-0 flex-col items-center gap-2.5 text-center"
            >
              <span
                className="relative block h-[88px] w-[88px] rounded-full p-[3px]"
                style={{ background: "linear-gradient(135deg,#c8372f,#e8894f)" }}
              >
                <span
                  className="block h-full w-full rounded-full border-2 border-white bg-cover bg-center"
                  style={{ backgroundImage: `url(https://picsum.photos/seed/${s.seed}/200/200)` }}
                />
                <span className="absolute -bottom-0.5 left-1/2 flex h-[26px] w-[26px] -translate-x-1/2 items-center justify-center rounded-full border-2 border-white bg-red-600">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M8 5v14l11-7z" fill="#fff" />
                  </svg>
                </span>
              </span>
              <span className="line-clamp-2 text-xs font-medium leading-tight text-ink">{s.labelKey}</span>
            </NextLink>
          ))}
        </div>
      </section>

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

      <section className="grid gap-6 sm:grid-cols-2">
        <div className="flex flex-col items-start gap-3 rounded-2xl bg-inverse p-8 sm:p-10 text-ink-inverse">
          <span className="text-xs font-semibold uppercase tracking-wider opacity-60">{tHome("b2bLabel")}</span>
          <h3 className="font-display text-2xl font-bold leading-tight tracking-tight">{tHome("b2bTitle")}</h3>
          <p className="max-w-md text-sm leading-relaxed opacity-70">{tHome("b2bText")}</p>
          <NextLink
            href="/b2b/register"
            className="mt-2 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-ink transition-colors hover:bg-white/90"
          >
            {tHome("b2bCta")} →
          </NextLink>
        </div>
        <div className="flex flex-col items-start gap-3 rounded-2xl bg-panel p-8 sm:p-10">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">{tHome("serviceLabel")}</span>
          <h3 className="font-display text-2xl font-bold leading-tight tracking-tight text-ink">{tHome("serviceTitle")}</h3>
          <p className="max-w-md text-sm leading-relaxed text-muted">{tHome("serviceText")}</p>
          <Link
            href="/delivery"
            className="mt-2 inline-flex items-center gap-2 rounded-xl bg-ink px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-ink/90"
          >
            {tHome("serviceCta")} →
          </Link>
        </div>
      </section>

      <section className="rounded-3xl bg-surface px-6 py-12 sm:p-16 text-center max-w-4xl mx-auto shadow-sm border border-line">
        <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink mb-4 tracking-tight">{tHome("heroTitle")}</h2>
        <p className="text-ink/80 leading-relaxed max-w-[700px] mx-auto mb-8 font-medium">
          {tHome("heroText")}
        </p>
        <Link href="/catalog" className="inline-block bg-inverse text-ink-inverse px-6 py-3 rounded-xl font-medium hover:opacity-90 transition-opacity">
          {tHome("goToCatalog")}
        </Link>
      </section>
    </div>
  );
}
