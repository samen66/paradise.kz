import { getTranslations } from "next-intl/server";
import { apiGet } from "@/lib/api";
import { getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { ContentPage, Settings, Category } from "@/lib/types";

async function contentPages(locale: string): Promise<Array<Pick<ContentPage, "slug" | "title">>> {
  try {
    const response = await apiGet<{ data: Array<Pick<ContentPage, "slug" | "title">> }>("/public/pages", {
      locale,
      revalidate: 600,
    });
    return response.data;
  } catch {
    return [];
  }
}

export async function Footer({ settings, categories }: { settings: Settings | null; categories: Category[] }) {
  const t = await getTranslations("footer");
  const tNav = await getTranslations("nav");
  const locale = await getLocale();
  const pages = await contentPages(locale);
  const contacts = settings?.contacts;
  const rootCategories = categories.filter((category) => category.parent_id === null);

  return (
    <footer className="mt-16 bg-surface">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
        <div className="flex flex-col md:flex-row items-center gap-6 rounded-2xl bg-panel px-6 py-8 sm:px-8 -translate-y-6 shadow-sm">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-white text-ink">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true" className="h-8 w-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
            </svg>
          </div>
          <div>
            <h2 className="font-display text-xl font-semibold text-ink">{t("delivery")}</h2>
            <p className="mt-1 max-w-xl text-muted">Мы осуществляем бережную доставку мебели по всему Казахстану. Поднимем на этаж и занесем в квартиру.</p>
          </div>
        </div>

        <div className="grid gap-10 py-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <h3 className="mb-4 font-display text-sm font-semibold uppercase tracking-wider text-ink/70">{t("contacts")}</h3>
            <ul className="space-y-3 text-sm text-ink">
              {contacts?.phone ? (
                <li>
                  <a href={`tel:${contacts.phone.replace(/[^+\d]/g, "")}`} className="font-display text-lg font-semibold hover:text-ink/80 transition">
                    {contacts.phone}
                  </a>
                </li>
              ) : null}
              {contacts?.email ? (
                <li>
                  <a href={`mailto:${contacts.email}`} className="text-muted hover:text-ink transition">
                    {contacts.email}
                  </a>
                </li>
              ) : null}
              {contacts?.address ? <li className="text-muted leading-relaxed">{contacts.address}</li> : null}
              <li className="flex gap-4 pt-2">
                {contacts?.whatsapp_url ? (
                  <a href={contacts.whatsapp_url} rel="noopener" target="_blank" className="text-muted hover:text-ink transition" aria-label="WhatsApp">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
                    </svg>
                  </a>
                ) : null}
                {contacts?.instagram_url ? (
                  <a href={contacts.instagram_url} rel="noopener" target="_blank" className="text-muted hover:text-ink transition" aria-label="Instagram">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
                    </svg>
                  </a>
                ) : null}
              </li>
            </ul>
          </div>
          
          <div>
            <h3 className="mb-4 font-display text-sm font-semibold uppercase tracking-wider text-ink/70">{t("info")}</h3>
            <ul className="space-y-3 text-sm">
              <li><Link href="/about" className="text-muted hover:text-ink transition">{tNav("about")}</Link></li>
              <li><Link href="/delivery" className="text-muted hover:text-ink transition">{tNav("delivery")}</Link></li>
              <li><Link href="/contacts" className="text-muted hover:text-ink transition">{tNav("contacts")}</Link></li>
              <li><Link href="/promotions" className="text-muted hover:text-ink transition">{tNav("promotions")}</Link></li>
              <li><Link href="/blog" className="text-muted hover:text-ink transition">{tNav("blog")}</Link></li>
              {pages.map((page) => (
                <li key={page.slug}>
                  <Link href={`/pages/${page.slug}`} className="text-muted hover:text-ink transition">
                    {page.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-4 font-display text-sm font-semibold uppercase tracking-wider text-ink/70">Каталог</h3>
            <ul className="space-y-3 text-sm">
              {rootCategories.map((cat) => (
                <li key={cat.id}>
                  <Link href={`/catalog/${cat.slug}`} className="text-muted hover:text-ink transition">
                    {cat.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-4 font-display text-sm font-semibold uppercase tracking-wider text-ink/70">{t("stores")}</h3>
            <ul className="space-y-4 text-sm">
              {(settings?.stores ?? []).map((store) => (
                <li key={store.id} className="text-muted leading-relaxed">
                  <span className="font-medium text-ink block">{store.name}</span>
                  {store.address ? <span>{store.address}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-line py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted">
          <Link href="/" className="font-display text-xl font-semibold tracking-tight text-ink/30 hover:text-ink transition">
            Paradise.kz
          </Link>
          <p>© {new Date().getFullYear()} Paradise.kz. {t("rights")}</p>
        </div>
      </div>
    </footer>
  );
}
