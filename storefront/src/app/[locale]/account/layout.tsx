"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth";
import { apiPost } from "@/lib/api";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("account");
  const tAuth = useTranslations("auth");
  const router = useRouter();
  const pathname = usePathname();
  const { token, user, clear } = useAuth();
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

  const userInitials = user?.name 
    ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() 
    : '👤';
  const displayPhone = user?.phone ?? "";
  const displayName = user?.name ?? "Пользователь";

  const navItems = [
    { href: "/account/profile", icon: "👤", label: t("profile"), count: null },
    { href: "/account/orders", icon: "📦", label: t("orders"), count: null },
    { href: "/account/favorites", icon: "♡", label: t("favorites"), count: null },
  ];

  async function logout() {
    try {
      await apiPost("/account/logout", {}, { token });
    } catch {
      // ignore
    }
    clear();
    router.push("/");
  }

  return (
    <div className="max-w-[1200px] mx-auto px-8 py-7 pb-16">
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-8 items-start">
        <aside className="sticky top-24 flex flex-col gap-[18px]">
          <div className="bg-white border border-line rounded-[20px] p-5 flex gap-3.5 items-center">
            <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center font-display font-bold text-[17px] text-ink shrink-0">
              {userInitials}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-[15px] text-ink truncate">{displayName}</div>
              <div className="text-xs text-muted truncate">{displayPhone}</div>
            </div>
          </div>
          
          <nav className="bg-white border border-line rounded-[20px] p-2 flex flex-col gap-0.5">
            {navItems.map((nav) => {
              const active = pathname === nav.href || pathname.startsWith(`${nav.href}/`);
              return (
                <Link
                  key={nav.href}
                  href={nav.href}
                  className={`flex items-center gap-3 px-3.5 py-[11px] rounded-[14px] text-sm transition-colors border-none w-full ${
                    active ? "bg-ink text-white font-semibold" : "bg-transparent text-ink hover:bg-card"
                  }`}
                >
                  <span className="text-base w-[22px] text-center">{nav.icon}</span>
                  <span className="flex-1 text-left">{nav.label}</span>
                  {nav.count !== null && (
                    <span className="text-xs font-semibold bg-line rounded-full px-2 py-0.5 text-muted">
                      {nav.count}
                    </span>
                  )}
                </Link>
              );
            })}
            
            <div className="h-px bg-line mx-2.5 my-1.5"></div>
            
            <button 
              onClick={() => void logout()}
              className="flex items-center gap-3 px-3.5 py-[11px] rounded-[14px] text-sm text-muted hover:bg-card transition-colors w-full text-left"
            >
              <span className="text-base w-[22px] text-center">↩</span>
              {tAuth("logout")}
            </button>
          </nav>
        </aside>

        <main className="min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
