import type { Metadata } from "next";
import { Golos_Text, Manrope } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { apiGet } from "@/lib/api";
import type { Category, Settings } from "@/lib/types";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AIAssistant } from "@/components/AIAssistant";
import { ToastContainer } from "@/components/ui/Toast";
import "../globals.css";

const golos = Golos_Text({
  subsets: ["latin", "cyrillic"],
  variable: "--font-golos",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-display-src",
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Paradise.kz — интернет-магазин",
    template: "%s | Paradise.kz",
  },
};

export function generateStaticParams() {
  // Intentionally empty: pages render on demand (on-demand ISR) so the
  // production image can be built without a reachable API. fetch-level
  // `revalidate` still caches data after the first request.
  return [];
}

async function layoutData(locale: string) {
  try {
    const [categories, settings] = await Promise.all([
      apiGet<{ data: Category[] }>("/public/categories", { locale, revalidate: 300 }),
      apiGet<{ data: Settings }>("/public/settings", { locale, revalidate: 300 }),
    ]);

    return { categories: categories.data, settings: settings.data };
  } catch {
    // The storefront chrome must survive an API hiccup — pages will surface
    // their own errors.
    return { categories: [], settings: null };
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const { categories, settings } = await layoutData(locale);

  return (
    <html lang={locale} className={`${golos.variable} ${manrope.variable}`} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col" suppressHydrationWarning>
        <NextIntlClientProvider>
          <Header categories={categories} settings={settings} />
          <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-8 sm:px-6 lg:px-10">
            {children}
          </main>
          <Footer settings={settings} categories={categories} />
          <AIAssistant />
          <ToastContainer />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
