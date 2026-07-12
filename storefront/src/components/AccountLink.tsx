"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth";

export function AccountLink() {
  const t = useTranslations("common");
  const tAuth = useTranslations("auth");
  const token = useAuth((state) => state.token);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const loggedIn = mounted && token !== null;

  return (
    <Link
      href={loggedIn ? "/account/orders" : "/login"}
      className="flex items-center gap-2 text-sm font-medium text-ink transition hover:opacity-70"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true" className="h-6 w-6">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
      </svg>
      <span className="hidden lg:inline">{loggedIn ? t("account") : tAuth("login")}</span>
    </Link>
  );
}
