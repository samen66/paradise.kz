import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export interface Crumb {
  label: string;
  href?: string;
}

export async function Breadcrumbs({ items }: { items: Crumb[] }) {
  const t = await getTranslations("common");

  return (
    <nav className="mb-4 text-sm text-muted">
      <ol className="flex flex-wrap items-center gap-1.5">
        <li>
          <Link href="/" className="hover:text-ink">
            {t("home")}
          </Link>
        </li>
        {items.map((item, index) => (
          <li key={index} className="flex items-center gap-1.5">
            <span className="text-line-strong">/</span>
            {item.href ? (
              <Link href={item.href} className="hover:text-ink">
                {item.label}
              </Link>
            ) : (
              <span className="text-ink">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
