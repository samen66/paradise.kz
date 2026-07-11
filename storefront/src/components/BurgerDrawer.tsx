"use client";

import { useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import type { Category, Settings } from "@/lib/types";
import { Drawer } from "./ui/Drawer";

export function BurgerDrawer({
  open,
  onClose,
  categories,
  settings,
}: {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  settings: Settings | null;
}) {
  const t = useTranslations("nav");
  const [expanded, setExpanded] = useState<number | null>(null);
  const pathname = usePathname();

  // Close drawer on navigation
  const handleLinkClick = () => {
    onClose();
  };

  return (
    <Drawer open={open} onClose={onClose} side="left" title={t("menu")}>
      <div className="flex flex-col gap-6">
        <div className="-mx-5 sm:-mx-6 px-5 sm:px-6">
          <ul className="flex flex-col">
            {categories.map((cat) => {
              const hasChildren = cat.children && cat.children.length > 0;
              const isExpanded = expanded === cat.id;

              return (
                <li key={cat.id} className="border-b border-line last:border-0">
                  <div className="flex items-center justify-between py-3">
                    <Link
                      href={`/catalog/${cat.slug}`}
                      onClick={handleLinkClick}
                      className="flex-1 font-medium"
                    >
                      {cat.name}
                    </Link>
                    {hasChildren && (
                      <button
                        type="button"
                        onClick={() => setExpanded(isExpanded ? null : cat.id)}
                        className="p-2 text-muted transition hover:text-ink"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.5}
                          className={`h-5 w-5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                        </svg>
                      </button>
                    )}
                  </div>
                  {hasChildren && isExpanded && (
                    <ul className="mb-3 space-y-2 pl-3">
                      {cat.children?.map((child) => (
                        <li key={child.id}>
                          <Link
                            href={`/catalog/${child.slug}`}
                            onClick={handleLinkClick}
                            className="block py-1 text-sm text-muted hover:text-ink"
                          >
                            {child.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex flex-col gap-3 pt-2">
          <Link href="/about" onClick={handleLinkClick} className="text-sm font-medium hover:text-ink/80">{t("about")}</Link>
          <Link href="/delivery" onClick={handleLinkClick} className="text-sm font-medium hover:text-ink/80">{t("delivery")}</Link>
          <Link href="/contacts" onClick={handleLinkClick} className="text-sm font-medium hover:text-ink/80">{t("contacts")}</Link>
          <Link href="/promotions" onClick={handleLinkClick} className="text-sm font-medium text-sale hover:text-sale/80">{t("promotions")}</Link>
          <Link href="/blog" onClick={handleLinkClick} className="text-sm font-medium hover:text-ink/80">{t("blog")}</Link>
        </div>

        {settings?.contacts.phone && (
          <div className="mt-4 border-t border-line pt-6">
            <a href={`tel:${settings.contacts.phone}`} className="block font-display text-lg font-semibold">
              {settings.contacts.phone}
            </a>
            {settings.contacts.whatsapp_url && (
              <a
                href={settings.contacts.whatsapp_url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-[#25D366] hover:opacity-80"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
                </svg>
                Написать в WhatsApp
              </a>
            )}
          </div>
        )}
      </div>
    </Drawer>
  );
}
