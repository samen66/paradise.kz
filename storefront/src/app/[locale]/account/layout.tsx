"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth";

import { useSelectedLayoutSegment } from "next/navigation";

const sections = [
  { href: "/account/profile", segment: "profile", key: "profile" },
  { href: "/account/orders", segment: "orders", key: "orders" },
  { href: "/account/addresses", segment: "addresses", key: "addresses" },
  { href: "/account/favorites", segment: "favorites", key: "favorites" },
] as const;

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("account");
  const router = useRouter();
  const pathname = usePathname();
  const segment = useSelectedLayoutSegment();
  const { token } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (mounted && token === null) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [mounted, token, router, pathname]);

  if (!mounted || token === null) {
    return null;
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl lg:text-[34px] leading-tight">
        {t("title")}
      </h1>

      <nav className="mt-6 flex gap-6 overflow-x-auto border-b border-line">
        {sections.map((section) => {
          const active = segment === section.segment;
          return (
            <Link
              key={section.href}
              href={section.href}
              className={`-mb-px whitespace-nowrap border-b-2 pb-3 text-sm font-medium transition-colors ${
                active ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {t(section.key)}
            </Link>
          );
        })}
      </nav>

      <div className="mt-8">{children}</div>
    </div>
  );
}
