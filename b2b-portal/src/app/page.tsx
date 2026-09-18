import Image from "next/image";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { apiGet } from "@/lib/api";
import type { B2bHome, Settings } from "@/lib/types";
import { PartnerLink, WelcomeHeader } from "@/components/welcome/WelcomeHeader";
import { WelcomeHero } from "@/components/welcome/WelcomeHero";
import { StyleSection } from "@/components/welcome/StyleSection";

const TERMS = ["prices", "warehouse", "delivery", "manager"] as const;

const EMPTY_HOME: B2bHome = { banners: [], about: null, collections: [] };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("welcome");

  return { title: { absolute: t("metaTitle") }, description: t("metaDescription") };
}

/** The page must render even when the API is down — it is the portal's front door. */
async function loadHome(locale: string): Promise<B2bHome> {
  try {
    return (await apiGet<{ data: B2bHome }>("/b2b/home", { locale, revalidate: 300 })).data;
  } catch {
    return EMPTY_HOME;
  }
}

async function loadContacts(locale: string): Promise<Settings["contacts"] | null> {
  try {
    return (await apiGet<{ data: Settings }>("/public/settings", { locale, revalidate: 300 })).data.contacts;
  } catch {
    return null;
  }
}

export default async function WelcomePage() {
  const locale = await getLocale();
  const t = await getTranslations("welcome");
  const [home, contacts] = await Promise.all([loadHome(locale), loadContacts(locale)]);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <WelcomeHeader />

      <main className="flex-1">
        <WelcomeHero banners={home.banners} />

        {home.about ? (
          <section className="mx-auto grid max-w-[1400px] items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-10">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">{t("aboutEyebrow")}</p>
              {home.about.title ? (
                <h2 className="mt-3 font-display text-3xl font-semibold text-ink sm:text-4xl">{home.about.title}</h2>
              ) : null}
              {home.about.text ? (
                <p className="mt-6 whitespace-pre-line text-lg leading-relaxed text-muted">{home.about.text}</p>
              ) : null}
            </div>
            {home.about.image ? (
              <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-card">
                <Image src={home.about.image} alt={home.about.title ?? ""} fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
              </div>
            ) : null}
          </section>
        ) : null}

        {home.collections.length > 0 ? (
          <div className="border-t border-line py-10">
            <div className="mx-auto max-w-[1400px] px-4 pt-10 sm:px-6 lg:px-10">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">{t("stylesEyebrow")}</p>
              <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold text-ink sm:text-4xl">{t("stylesTitle")}</h2>
            </div>
            {home.collections.map((collection, index) => (
              <StyleSection key={collection.id} collection={collection} reversed={index % 2 === 1} />
            ))}
          </div>
        ) : null}

        <section className="bg-panel">
          <div className="mx-auto max-w-[1400px] px-4 py-20 sm:px-6 lg:px-10">
            <h2 className="font-display text-3xl font-semibold text-ink sm:text-4xl">{t("termsTitle")}</h2>
            <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {TERMS.map((key) => (
                <li key={key} className="rounded-2xl bg-white p-6">
                  <h3 className="text-lg font-semibold text-ink">{t(`terms.${key}.title`)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{t(`terms.${key}.text`)}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-[1400px] px-4 py-20 text-center sm:px-6 lg:px-10">
          <h2 className="font-display text-3xl font-semibold text-ink sm:text-4xl">{t("ctaTitle")}</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted">{t("ctaText")}</p>
          <PartnerLink className="mt-8 inline-flex rounded-full bg-ink px-8 py-4 font-semibold text-white transition hover:bg-ink-hover" />
        </section>
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto grid max-w-[1400px] gap-6 px-4 py-10 text-sm text-muted sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-10">
          <div className="font-display text-xl font-semibold text-ink">Paradise B2B</div>
          {contacts?.phone ? (
            <div>
              <div className="font-medium text-ink">{t("phone")}</div>
              <a href={`tel:${contacts.phone.replace(/[^\d+]/g, "")}`} className="hover:text-ink">{contacts.phone}</a>
            </div>
          ) : null}
          {contacts?.whatsapp_url ? (
            <div>
              <div className="font-medium text-ink">{t("whatsapp")}</div>
              <a href={contacts.whatsapp_url} target="_blank" rel="noopener noreferrer" className="hover:text-ink">wa.me</a>
            </div>
          ) : null}
          {contacts?.address ? (
            <div>
              <div className="font-medium text-ink">{t("address")}</div>
              <p>{contacts.address}</p>
            </div>
          ) : null}
        </div>
        <div className="border-t border-line py-6 text-center text-xs text-muted">
          {t("rights", { year: new Date().getFullYear() })}
        </div>
      </footer>
    </div>
  );
}
