"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Portal } from "@/components/ui/Portal";

import type { ProductShowroom } from "@/lib/types";

interface ShowroomAvailabilityProps {
  showrooms: ProductShowroom[];
}

export function ShowroomAvailability({ showrooms }: ShowroomAvailabilityProps) {
  const [mapSr, setMapSr] = useState<ProductShowroom | null>(null);

  if (!showrooms || showrooms.length === 0) return null;

  function srPlural(n: number) {
    const n10 = n % 10;
    const n100 = n % 100;
    if (n10 === 1 && n100 !== 11) return "точка";
    if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return "точки";
    return "точек";
  }

  const getStatusMeta = (status: string, qty: number) => {
    if (status === "high" || qty >= 5) {
      return { label: "Много", bg: "var(--color-mint,#e3f3ea)", color: "var(--color-mint-ink,#1d6b4f)", dot: "#1d6b4f" };
    }
    if (status === "low" || (qty > 0 && qty < 5)) {
      return { label: `Мало — ${qty} шт`, bg: "#fef3c7", color: "#b45309", dot: "#d97706" };
    }
    return { label: "Нет в наличии", bg: "var(--color-neutral-100,#f0eee9)", color: "var(--color-neutral-600,#5f5a50)", dot: "#8a8477" };
  };

  return (
    <>
      <section className="mt-6 rounded-[20px] border border-line bg-white p-7 shadow-[0_1px_2px_rgba(28,26,23,0.04),0_12px_32px_rgba(28,26,23,0.05)] sm:px-8">
        <div className="mb-1 flex items-baseline gap-3">
          <h2 className="font-display text-xl font-bold text-ink">Есть в наличии в шоурумах</h2>
          <span className="text-sm text-muted">
            {showrooms.length} {srPlural(showrooms.length)}
          </span>
        </div>
        <p className="mb-1.5 text-sm text-muted">
          Посмотрите и заберите сегодня — наличие указано для каждой точки.
        </p>

        <div className="flex flex-col">
          {showrooms.map((sr) => {
            const status = sr.stock >= 5 ? "high" : (sr.stock > 0 ? "low" : "out");
            const meta = getStatusMeta(status, sr.stock);
            return (
              <div
                key={sr.store.id}
                className="flex flex-wrap items-center justify-between gap-4 border-t border-line py-4 first:border-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Link
                      href={`/showrooms/${sr.store.id}`}
                      className="text-[15px] font-semibold text-ink decoration-2 hover:underline"
                    >
                      {sr.store.name}
                    </Link>
                    <span
                      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold"
                      style={{ background: meta.bg, color: meta.color }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: meta.dot }}
                      />
                      {meta.label}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5 text-[13px] text-muted">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0">
                      <path d="M12 21s7-6.4 7-11a7 7 0 10-14 0c0 4.6 7 11 7 11z" stroke="currentColor" strokeWidth="1.7" />
                      <circle cx="12" cy="10" r="2.3" stroke="currentColor" strokeWidth="1.7" />
                    </svg>
                    <span>
                      {sr.store.address || "Адрес не указан"}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => setMapSr(sr)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3.5 py-2.5 text-[13px] font-semibold text-ink transition hover:border-ink hover:bg-neutral-50"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M9 4L3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4z" stroke="var(--color-red-600,#c8372f)" strokeWidth="1.6" strokeLinejoin="round" />
                      <path d="M9 4v13M15 6.5v13" stroke="var(--color-red-600,#c8372f)" strokeWidth="1.6" />
                    </svg>
                    Показать на карте
                  </button>
                  <Link
                    href={`/showrooms/${sr.store.id}`}
                    className="inline-flex items-center rounded-full bg-ink px-3.5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-ink-hover"
                  >
                    Подробнее
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-panel px-4 py-[13px] text-[13px] text-muted">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0">
            <path d="M3 13l2-6h9l3 3h4v5M5 16a2 2 0 104 0m6 0a2 2 0 104 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Нет удобной точки рядом? Бесплатная доставка по Алматы — завтра.
        </div>
      </section>

      {mapSr ? (
        <Portal>
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/55 p-6 backdrop-blur-sm"
            onClick={() => setMapSr(null)}
          >
            <div
              className="w-full max-w-md overflow-hidden rounded-[20px] bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 px-5 py-4 pb-3.5">
                <div>
                  <h3 className="m-0 font-display text-lg font-bold leading-tight text-ink">{mapSr.store.name}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setMapSr(null)}
                  aria-label="Закрыть"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-white transition hover:bg-neutral-50"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              {/* Fake Map stub */}
              <div className="relative h-[220px] bg-[#e9ebe6]">
                <svg viewBox="0 0 480 220" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
                  <rect width="480" height="220" fill="#e9ebe6" />
                  <path d="M-20 70 L160 30 L320 90 L500 40 L500 150 L300 180 L120 150 L-20 170 Z" fill="#dbe7f1" opacity="0.8" />
                  <ellipse cx="380" cy="160" rx="120" ry="80" fill="#dcefe0" />
                  <g stroke="#fff" strokeWidth="12" strokeLinecap="round" opacity="0.95">
                    <path d="M-20 120 L500 100" />
                    <path d="M-20 190 L500 200" />
                    <path d="M170 -20 L160 240" />
                    <path d="M330 -20 L345 240" />
                  </g>
                  <g stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity="0.8">
                    <path d="M80 -20 L70 240 M420 -20 L410 240 M-20 160 L500 155" />
                  </g>
                </svg>
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full drop-shadow-md">
                  <svg width="38" height="48" viewBox="0 0 28 36">
                    <path d="M14 0C6.3 0 0 6.1 0 13.7 0 24 14 36 14 36s14-12 14-22.3C28 6.1 21.7 0 14 0z" fill="var(--color-red-600,#c8372f)" stroke="#fff" strokeWidth="2" />
                    <circle cx="14" cy="13.5" r="5" fill="#fff" />
                  </svg>
                </div>
              </div>

              <div className="px-5 pb-5 pt-4">
                <div className="mb-4 flex items-start gap-2 text-sm text-neutral-600">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0 text-muted">
                    <path d="M12 21s7-6.4 7-11a7 7 0 10-14 0c0 4.6 7 11 7 11z" stroke="currentColor" strokeWidth="1.7" />
                    <circle cx="12" cy="10" r="2.3" stroke="currentColor" strokeWidth="1.7" />
                  </svg>
                  <span>
                    <b className="font-semibold text-ink">{mapSr.store.address}</b>
                  </span>
                </div>
                <div className="flex gap-2.5">
                  <a
                    href={`https://2gis.kz/almaty/search/${encodeURIComponent(mapSr.store.address || mapSr.store.name)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-1 items-center justify-center rounded-xl bg-red-600 px-3 py-3 text-sm font-bold text-white transition hover:bg-red-700"
                  >
                    Построить маршрут
                  </a>
                  <Link
                    href={`/showrooms/${mapSr.store.id}`}
                    className="flex flex-1 items-center justify-center rounded-xl border border-line bg-white px-3 py-3 text-sm font-semibold text-ink transition hover:border-ink hover:bg-neutral-50"
                  >
                    Страница шоурума
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </Portal>
      ) : null}
    </>
  );
}
