import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { apiGet, ApiError } from "@/lib/api";
import type { ContentPage, Settings } from "@/lib/types";
import { Breadcrumbs } from "@/components/Breadcrumbs";

const SLUG = "contacts";

async function fetchPage(locale: string): Promise<ContentPage | null> {
  try {
    const response = await apiGet<{ data: ContentPage }>(`/public/pages/${SLUG}`, {
      locale,
      revalidate: 600,
    });
    return response.data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

async function fetchSettings(locale: string): Promise<Settings> {
  const response = await apiGet<{ data: Settings }>("/public/settings", {
    locale,
    revalidate: 600,
  });
  return response.data;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const page = await fetchPage(locale);

  return {
    title: page?.seo_title ?? page?.title ?? "Контакты — Paradise",
    description: page?.seo_description ?? undefined,
  };
}

export default async function ContactsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [page, settings] = await Promise.all([
    fetchPage(locale),
    fetchSettings(locale),
  ]);

  const { contacts, stores } = settings;

  return (
    <div className="mx-auto max-w-[720px]">
      <Breadcrumbs items={[{ label: page?.title ?? "Контакты" }]} />
      <h1 className="mb-6 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl lg:text-[34px] leading-tight">
        {page?.title ?? "Контакты"}
      </h1>

      {/* Contact cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        {contacts.phone ? (
          <a
            href={`tel:${contacts.phone}`}
            className="group rounded-2xl border border-line bg-panel p-5 transition hover:border-ink"
          >
            <p className="text-sm text-muted">Телефон</p>
            <p className="mt-1 text-lg font-semibold text-ink group-hover:underline">
              {contacts.phone}
            </p>
          </a>
        ) : null}

        {contacts.email ? (
          <a
            href={`mailto:${contacts.email}`}
            className="group rounded-2xl border border-line bg-panel p-5 transition hover:border-ink"
          >
            <p className="text-sm text-muted">Email</p>
            <p className="mt-1 text-lg font-semibold text-ink group-hover:underline">
              {contacts.email}
            </p>
          </a>
        ) : null}

        {contacts.whatsapp_url ? (
          <a
            href={contacts.whatsapp_url}
            target="_blank"
            rel="noopener noreferrer"
            className="group rounded-2xl border border-line bg-panel p-5 transition hover:border-ink"
          >
            <p className="text-sm text-muted">WhatsApp</p>
            <p className="mt-1 text-lg font-semibold text-ink group-hover:underline">
              Написать в WhatsApp
            </p>
          </a>
        ) : null}

        {contacts.instagram_url ? (
          <a
            href={contacts.instagram_url}
            target="_blank"
            rel="noopener noreferrer"
            className="group rounded-2xl border border-line bg-panel p-5 transition hover:border-ink"
          >
            <p className="text-sm text-muted">Instagram</p>
            <p className="mt-1 text-lg font-semibold text-ink group-hover:underline">
              @paradise.kz
            </p>
          </a>
        ) : null}
      </div>

      {/* Address */}
      {contacts.address ? (
        <div className="mb-8 rounded-2xl border border-line bg-panel p-5">
          <p className="text-sm text-muted">Адрес</p>
          <p className="mt-1 text-base text-ink">{contacts.address}</p>
        </div>
      ) : null}

      {/* Stores / showrooms */}
      {stores.length > 0 ? (
        <div className="mb-8">
          <h2 className="mb-4 font-display text-xl font-semibold text-ink">
            Наши точки
          </h2>
          <div className="grid gap-3">
            {stores.map((store) => (
              <div
                key={store.id}
                className="rounded-2xl border border-line bg-panel p-5"
              >
                <p className="font-medium text-ink">{store.name}</p>
                {store.address ? (
                  <p className="mt-1 text-sm text-muted">{store.address}</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* CMS content body */}
      {page?.body ? (
        <div
          className="text-ink [&>*:first-child]:mt-0 [&_a]:text-ink [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:no-underline [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-ink [&_h3]:mt-8 [&_h3]:mb-2 [&_h3]:font-display [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-ink [&_p]:mb-4 [&_p]:leading-relaxed [&_p]:text-ink [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-5 [&_li]:leading-relaxed [&_li]:text-ink [&_strong]:font-semibold [&_img]:my-6 [&_img]:max-w-full [&_img]:rounded-2xl"
          dangerouslySetInnerHTML={{ __html: page.body }}
        />
      ) : null}
    </div>
  );
}
