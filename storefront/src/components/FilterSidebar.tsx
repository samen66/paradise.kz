"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useLocale } from "next-intl";
import { Drawer } from "./ui/Drawer";
import type { Facets } from "@/lib/types";
import { tValue } from "@/lib/format";

export function FilterSidebar({ facets, isB2B }: { facets: Facets; isB2B?: boolean }) {
  const t = useTranslations("catalog");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = useLocale();

  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [priceMin, setPriceMin] = useState(searchParams.get("price_min") ?? "");
  const [priceMax, setPriceMax] = useState(searchParams.get("price_max") ?? "");

  const selectedBrands = new Set((searchParams.get("brand") ?? "").split(",").filter(Boolean));
  const selectedAttrs = new Map<string, Set<string>>();
  for (const [key, value] of searchParams.entries()) {
    const match = key.match(/^attr\[(.+)]$/);
    if (match) {
      selectedAttrs.set(match[1], new Set(value.split(",").filter(Boolean)));
    }
  }

  const activeCount = Array.from(searchParams.keys()).filter((k) => k !== "page" && k !== "sort").length;

  function apply(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  function toggleSetParam(params: URLSearchParams, key: string, value: string) {
    const current = new Set((params.get(key) ?? "").split(",").filter(Boolean));
    if (current.has(value)) {
      current.delete(value);
    } else {
      current.add(value);
    }
    if (current.size === 0) {
      params.delete(key);
    } else {
      params.set(key, [...current].join(","));
    }
  }

  const inputClass =
    "w-full rounded-xl border border-line bg-card px-3 py-2 text-ink placeholder:text-muted outline-none focus:border-line-strong";

  const Chevron = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4 text-muted transition group-open:rotate-180">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  );

  const FilterContent = () => (
    <div className="space-y-6 text-sm">
      {!isB2B && (
        <details open className="group">
          <summary className="font-semibold text-ink cursor-pointer list-none flex items-center justify-between [&::-webkit-details-marker]:hidden select-none">
            {t("price")}
            <Chevron />
          </summary>
          <div className="pt-4">
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                value={priceMin}
                onChange={(event) => setPriceMin(event.target.value)}
                placeholder={`${t("from")}${facets.price.min !== null ? ` ${Math.floor(facets.price.min)}` : ""}`}
                className={inputClass}
              />
              <input
                type="number"
                inputMode="numeric"
                value={priceMax}
                onChange={(event) => setPriceMax(event.target.value)}
                placeholder={`${t("to")}${facets.price.max !== null ? ` ${Math.ceil(facets.price.max)}` : ""}`}
                className={inputClass}
              />
            </div>
            <button
              type="button"
              onClick={() =>
                apply((params) => {
                  if (priceMin) params.set("price_min", priceMin);
                  else params.delete("price_min");
                  if (priceMax) params.set("price_max", priceMax);
                  else params.delete("price_max");
                })
              }
              className="mt-3 w-full rounded-xl bg-inverse py-2.5 font-medium text-ink-inverse transition hover:opacity-90"
            >
              {t("apply")}
            </button>
          </div>
        </details>
      )}

      <div className="pt-2">
        <label
          className={`flex cursor-pointer items-center gap-3 rounded-xl p-3 transition ${
            searchParams.get("in_stock") === "1" ? "bg-black/5 text-ink" : "text-ink hover:bg-black/5"
          }`}
        >
          <input
            type="checkbox"
            className="peer h-4 w-4 rounded bg-surface border-line-strong text-zinc-900 focus:ring-zinc-900 focus:ring-offset-0 transition-all checked:bg-zinc-900 checked:border-zinc-900"
            checked={searchParams.get("in_stock") === "1"}
            onChange={(event) =>
              apply((params) => {
                if (event.target.checked) params.set("in_stock", "1");
                else params.delete("in_stock");
              })
            }
          />
          <span className="font-medium">{t("onlyInStock")}</span>
        </label>
      </div>

      {facets.brands.length > 0 ? (
        <div className="pt-6">
          <details open className="group">
            <summary className="font-semibold text-ink cursor-pointer list-none flex items-center justify-between [&::-webkit-details-marker]:hidden select-none">
              {t("brand")}
              <Chevron />
            </summary>
            <ul className="pt-4 space-y-2.5">
              {facets.brands.map((brand) => (
                <li key={brand.id}>
                  <label className="flex cursor-pointer items-center gap-3 text-ink">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-line-strong text-zinc-900 focus:ring-zinc-900"
                      checked={selectedBrands.has(brand.slug)}
                      onChange={() => apply((params) => toggleSetParam(params, "brand", brand.slug))}
                    />
                    <span className="flex-1 text-sm">{tValue(brand.name, locale)}</span>
                    <span className="text-xs text-muted font-medium">{brand.count}</span>
                  </label>
                </li>
              ))}
            </ul>
          </details>
        </div>
      ) : null}

      {facets.attributes.map((attribute) => (
        <div key={attribute.slug} className="pt-6">
          <details open className="group">
            <summary className="font-semibold text-ink cursor-pointer list-none flex items-center justify-between [&::-webkit-details-marker]:hidden select-none">
              {tValue(attribute.name, locale)}
              <Chevron />
            </summary>
            <ul className="pt-4 max-h-48 space-y-2.5 overflow-y-auto pr-2 scrollbar-hide">
              {attribute.values.map((option) => (
                <li key={option.value}>
                  <label className="flex cursor-pointer items-center gap-3 text-ink">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-line-strong text-zinc-900 focus:ring-zinc-900"
                      checked={selectedAttrs.get(attribute.slug)?.has(option.value) ?? false}
                      onChange={() => apply((params) => toggleSetParam(params, `attr[${attribute.slug}]`, option.value))}
                    />
                    <span className="text-sm">{option.label}</span>
                  </label>
                </li>
              ))}
            </ul>
          </details>
        </div>
      ))}

      <div className="pt-6">
        <button
          type="button"
          onClick={() => {
            setIsMobileOpen(false);
            router.push(pathname);
          }}
          className="w-full rounded-xl border border-line-strong py-2.5 font-medium text-ink transition hover:border-ink hover:bg-surface"
        >
          {t("reset")}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block h-fit rounded-2xl bg-transparent p-5 lg:sticky lg:top-[130px]">
        <FilterContent />
      </aside>

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 lg:hidden pointer-events-none">
        <button
          type="button"
          onClick={() => setIsMobileOpen(true)}
          className="pointer-events-auto flex items-center gap-2 rounded-full bg-ink px-6 py-3.5 text-sm font-medium text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
          </svg>
          {t("filters")} {activeCount > 0 ? `(${activeCount})` : ""}
        </button>
      </div>

      <Drawer
        open={isMobileOpen}
        onClose={() => setIsMobileOpen(false)}
        side="bottom"
        title={t("filters")}
      >
        <FilterContent />
      </Drawer>
    </>
  );
}
