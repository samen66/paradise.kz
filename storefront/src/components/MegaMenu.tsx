"use client";

import { useState, useRef } from "react";
import { Link } from "@/i18n/navigation";
import type { Category } from "@/lib/types";
import { useLocale } from "next-intl";
import { tValue } from "@/lib/format";

export function MegaMenu({ categories }: { categories: Category[] }) {
  const [activeId, setActiveId] = useState<number | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout>(null);
  const locale = useLocale();

  const handleEnter = (id: number) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setActiveId(id);
  };

  const handleLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setActiveId(null);
    }, 150);
  };

  return (
    <ul className="flex items-center gap-6">
      {categories.map((category) => {
        const hasChildren = category.children && category.children.length > 0;
        const isActive = activeId === category.id;

        return (
          <li
            key={category.id}
            onMouseEnter={() => handleEnter(category.id)}
            onMouseLeave={handleLeave}
            className="relative"
          >
            <Link
              href={`/catalog/${category.slug}`}
              className="group flex items-center gap-1.5 py-4 text-sm font-medium transition-colors hover:text-ink/80"
            >
              {tValue(category.name, locale)}
              {hasChildren && (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  className={`h-4 w-4 transition-transform ${isActive ? "rotate-180" : ""}`}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              )}
            </Link>

            {hasChildren && isActive && (
              <div className="absolute left-0 top-full z-50 w-max min-w-[600px] max-w-[800px] rounded-2xl border border-line bg-white p-6 shadow-xl animate-[fade-in_0.15s_ease-out]">
                <div className="grid grid-cols-3 gap-x-8 gap-y-6">
                  {category.children?.map((child) => (
                    <div key={child.id}>
                      <Link
                        href={`/catalog/${child.slug}`}
                        className="mb-3 block font-display text-base font-semibold hover:text-ink/80"
                      >
                        {tValue(child.name, locale)}
                      </Link>
                      {child.children && child.children.length > 0 && (
                        <ul className="space-y-2">
                          {child.children.map((sub) => (
                            <li key={sub.id}>
                              <Link
                                href={`/catalog/${sub.slug}`}
                                className="text-sm text-muted hover:text-ink"
                              >
                                {tValue(sub.name, locale)}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
