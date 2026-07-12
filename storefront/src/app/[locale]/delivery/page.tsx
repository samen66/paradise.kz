import { setRequestLocale } from "next-intl/server";

export default async function DeliveryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="mx-auto max-w-4xl px-4 py-32 sm:px-6 lg:px-8 text-center">
      <h1 className="text-3xl font-display font-semibold mb-4 text-ink">Раздел в разработке</h1>
      <p className="text-muted">Эта страница скоро появится на сайте.</p>
    </div>
  );
}
