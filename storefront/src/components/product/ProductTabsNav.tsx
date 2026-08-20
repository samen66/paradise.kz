"use client";

import { useEffect, useState, useRef } from "react";
import { useTranslations } from "next-intl";

interface TabItem {
  id: string;
  labelKey: string;
  fallback: string;
  count?: number;
}

const TABS: TabItem[] = [
  { id: "about", labelKey: "description", fallback: "Описание" },
  { id: "specs", labelKey: "characteristics", fallback: "Характеристики" },
  { id: "showrooms", labelKey: "showrooms", fallback: "Шоурумы" },
  { id: "reviews", labelKey: "reviewsTitle", fallback: "Отзывы" },
];

export function ProductTabsNav({
  reviewCount,
  hasAbout = false,
  hasSpecs = false,
  hasShowrooms = false,
  hasReviews = true,
}: {
  reviewCount?: number;
  hasAbout?: boolean;
  hasSpecs?: boolean;
  hasShowrooms?: boolean;
  hasReviews?: boolean;
}) {
  const [activeId, setActiveId] = useState<string>("");
  const navRef = useRef<HTMLElement>(null);
  const visibleSections = useRef<Record<string, boolean>>({});

  const t = useTranslations("product");

  function getText(key: string, fallback: string): string {
    return t(key) || fallback;
  }

  // IntersectionObserver to highlight active section
  // Determine visible tabs based on props rather than DOM
  const visibleTabs = TABS.filter((tab) => {
    if (tab.id === "about") return hasAbout;
    if (tab.id === "specs") return hasSpecs;
    if (tab.id === "showrooms") return hasShowrooms;
    if (tab.id === "reviews") return hasReviews;
    return true;
  });

  // IntersectionObserver to highlight active section
  useEffect(() => {
    const sections = visibleTabs.map((tab) => document.getElementById(tab.id)).filter(Boolean) as HTMLElement[];

    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Update visibility map for all changed entries
        entries.forEach((e) => {
          visibleSections.current[e.target.id] = e.isIntersecting;
        });

        // Find the first tab in our visibleTabs array that is currently visible
        const firstVisible = visibleTabs.find((tab) => visibleSections.current[tab.id]);
        if (firstVisible) {
          setActiveId(firstVisible.id);
        }
      },
      {
        rootMargin: "-200px 0px -40% 0px",
        threshold: 0,
      }
    );

    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [visibleTabs]);

  const handleClick = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  if (visibleTabs.length === 0) return null;

  return (
    <nav
      ref={navRef}
      className="sticky top-[64px] lg:top-[130px] z-20 -mx-4 px-4 lg:-mx-0 lg:px-0 bg-white/95 dark:bg-card/95 backdrop-blur-md border-y border-line"
    >
      <div className="flex gap-6 overflow-x-auto scrollbar-none text-xs lg:text-[13px] tracking-wide uppercase">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleClick(tab.id)}
            className={`whitespace-nowrap py-3.5 border-b-2 transition-colors ${
              activeId === tab.id
                ? "border-ink text-ink font-semibold"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {getText(tab.labelKey, tab.fallback)}
            {tab.id === "reviews" && reviewCount ? (
              <span className="ml-1.5 tabular-nums">{reviewCount}</span>
            ) : null}
          </button>
        ))}
      </div>
    </nav>
  );
}
