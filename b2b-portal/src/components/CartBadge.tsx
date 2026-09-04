"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useCart } from "@/lib/cart";

export function CartBadge() {
  const t = useTranslations("common");
  const items = useCart((state) => state.items);
  // Avoid a hydration mismatch: localStorage is only readable on the client.
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const count = mounted ? items.reduce((sum, item) => sum + item.quantity, 0) : 0;

  return (
    <Link href="/cart" className="flex items-center gap-2 text-sm font-medium text-ink transition hover:opacity-70">
      <span className="relative">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true" className="h-6 w-6">
          <path d="M3 4h2l2.4 12.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L21 8H6" />
          <circle cx="9" cy="20" r="1.4" />
          <circle cx="18" cy="20" r="1.4" />
        </svg>
        {count > 0 ? (
          <span className="absolute -right-2 -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-ink px-1 text-[10px] font-semibold text-white">
            {count}
          </span>
        ) : null}
      </span>
      <span className="hidden lg:inline">{t("cart")}</span>
    </Link>
  );
}
