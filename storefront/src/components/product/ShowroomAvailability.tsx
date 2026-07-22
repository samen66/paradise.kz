"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";

// ── Types ───────────────────────────────────────────────────────────────────

interface ShowroomStock {
  name: string;
  slug: string;
  city: string;
  district: string;
  address: string;
  landmark: string;
  lat: number;
  lng: number;
  citySlug: string;
  status: "in" | "low" | "order" | "sample";
  qty?: number;
}

interface StatusMeta {
  label: string;
  bg: string;
  color: string;
  dot: string;
}

function statusMeta(status: string, qty?: number): StatusMeta {
  switch (status) {
    case "in":
      return { label: "В наличии", bg: "#e3f3ea", color: "#1d6b4f", dot: "#2f9e6f" };
    case "low":
      return { label: qty ? `Мало · ${qty} шт` : "Мало", bg: "#f6efe3", color: "#a9631a", dot: "#d08a2e" };
    case "order":
      return { label: "Под заказ", bg: "#eef1f8", color: "#4a5bb0", dot: "#5b6ee0" };
    case "sample":
      return { label: "Выставочный образец", bg: "#f2ecf7", color: "#7b4fa8", dot: "#9a6fc4" };
    default:
      return { label: "Нет в наличии", bg: "#f0eee9", color: "#8a8477", dot: "#c2bcb1" };
  }
}

function routeUrl(sh: ShowroomStock): string {
  return `https://2gis.kz/${sh.citySlug}/directions/points/%7C${sh.lng}%2C${sh.lat}%3B`;
}

function srPlural(n: number): string {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return "точка";
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return "точки";
  return "точек";
}

// ── Component ───────────────────────────────────────────────────────────────

export function ShowroomAvailability({ showrooms }: { showrooms: ShowroomStock[] }) {
  const t = useTranslations("product");
  const [mapSr, setMapSr] = useState<ShowroomStock | null>(null);

  const closeMap = useCallback(() => setMapSr(null), []);

  if (showrooms.length === 0) return null;

  return (
    <>
      <section className="rounded-[20px] border border-line bg-white p-7 shadow-[0_1px_2px_rgba(28,26,23,0.04),0_12px_32px_rgba(28,26,23,0.05)]">
        <div className="mb-1 flex items-baseline gap-3">
          <h2 className="font-display text-xl font-bold text-ink">{t("showrooms")}</h2>
          <span className="text-sm text-muted">
            {showrooms.length} {srPlural(showrooms.length)}
          </span>
        </div>
        <p className="mb-1.5 text-sm text-muted">{t("showroomHint")}</p>

        <div className="flex flex-col">
          {showrooms.map((sr) => {
            const meta = statusMeta(sr.status, sr.qty);
            return (
              <div
                key={sr.slug}
                className="flex flex-wrap items-center justify-between gap-4 border-t border-surface py-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="text-[15px] font-semibold text-ink">{sr.name}</span>
                    <span
                      className="inline-flex items-center gap-[5px] whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold"
                      style={{ background: meta.bg, color: meta.color }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: meta.dot }}
                      />
                      {meta.label}
                    </span>
                  </div>
                  <div className="mt-[5px] flex items-center gap-[7px] text-[13px] text-muted">
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
                      <path d="M12 21s7-6.4 7-11a7 7 0 10-14 0c0 4.6 7 11 7 11z" stroke="#8a8477" strokeWidth={1.7} />
                      <circle cx={12} cy={10} r={2.3} stroke="#8a8477" strokeWidth={1.7} />
                    </svg>
                    <span>{sr.city} · {sr.district} · {sr.address}</span>
                  </div>
                </div>

                <div className="flex flex-shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => setMapSr(sr)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3.5 py-[9px] text-[13px] font-semibold text-ink transition hover:border-ink"
                  >
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                      <path d="M9 4L3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4z" stroke="#c8372f" strokeWidth={1.6} strokeLinejoin="round" />
                      <path d="M9 4v13M15 6.5v13" stroke="#c8372f" strokeWidth={1.6} />
                    </svg>
                    {t("showOnMap")}
                  </button>
                  <a
                    href={`/showroom/${sr.slug}`}
                    className="inline-flex items-center rounded-full bg-ink px-3.5 py-[9px] text-[13px] font-semibold text-white no-underline transition hover:bg-ink-hover"
                  >
                    {t("details")}
                  </a>
                </div>
              </div>
            );
          })}
        </div>

        {/* Delivery note */}
        <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-surface/50 px-4 py-3.5 text-[13px] text-muted">
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
            <path d="M3 13l2-6h9l3 3h4v5M5 16a2 2 0 104 0m6 0a2 2 0 104 0" stroke="#8a8477" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {t("freeDeliveryNote")}
        </div>
      </section>

      {/* Map modal */}
      {mapSr ? (
        <div
          className="fixed inset-0 z-80 flex items-center justify-center bg-black/55 p-6"
          onClick={closeMap}
        >
          <div
            className="w-full max-w-[480px] overflow-hidden rounded-[20px] bg-white shadow-[0_24px_60px_rgba(0,0,0,0.35)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 px-[22px] pt-5 pb-3.5">
              <div>
                <h3 className="font-display text-lg font-bold text-ink">{mapSr.name}</h3>
                <div className="mt-0.5 text-[13px] text-muted">
                  {mapSr.city} · {mapSr.district}
                </div>
              </div>
              <button
                type="button"
                onClick={closeMap}
                aria-label="Закрыть"
                className="flex h-[34px] w-[34px] flex-shrink-0 cursor-pointer items-center justify-center rounded-full border border-line bg-white"
              >
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <path d="M6 6l12 12M18 6L6 18" stroke="#1c1a17" strokeWidth={2} strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* SVG Map placeholder */}
            <div className="relative h-[220px] bg-[#e9ebe6]">
              <svg viewBox="0 0 480 220" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
                <rect width={480} height={220} fill="#e9ebe6" />
                <path d="M-20 70 L160 30 L320 90 L500 40 L500 150 L300 180 L120 150 L-20 170 Z" fill="#dbe7f1" opacity={0.8} />
                <ellipse cx={380} cy={160} rx={120} ry={80} fill="#dcefe0" />
                <g stroke="#fff" strokeWidth={12} strokeLinecap="round" opacity={0.95}>
                  <path d="M-20 120 L500 100" /><path d="M-20 190 L500 200" /><path d="M170 -20 L160 240" /><path d="M330 -20 L345 240" />
                </g>
                <g stroke="#fff" strokeWidth={5} strokeLinecap="round" opacity={0.8}>
                  <path d="M80 -20 L70 240 M420 -20 L410 240 M-20 160 L500 155" />
                </g>
              </svg>
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full drop-shadow-[0_4px_6px_rgba(0,0,0,0.3)]">
                <svg width={38} height={48} viewBox="0 0 28 36">
                  <path d="M14 0C6.3 0 0 6.1 0 13.7 0 24 14 36 14 36s14-12 14-22.3C28 6.1 21.7 0 14 0z" fill="#c8372f" stroke="#fff" strokeWidth={2} />
                  <circle cx={14} cy={13.5} r={5} fill="#fff" />
                </svg>
              </div>
            </div>

            {/* Footer */}
            <div className="px-[22px] pt-4 pb-[22px]">
              <div className="mb-4 flex items-start gap-2 text-sm text-muted">
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" className="mt-px flex-shrink-0">
                  <path d="M12 21s7-6.4 7-11a7 7 0 10-14 0c0 4.6 7 11 7 11z" stroke="#8a8477" strokeWidth={1.7} />
                  <circle cx={12} cy={10} r={2.3} stroke="#8a8477" strokeWidth={1.7} />
                </svg>
                <span>
                  <b className="font-semibold text-ink">{mapSr.address}</b> · {mapSr.landmark}
                </span>
              </div>
              <div className="flex gap-2.5">
                <a
                  href={routeUrl(mapSr)}
                  target="_blank"
                  rel="noopener"
                  className="flex flex-1 items-center justify-center gap-[7px] rounded-xl bg-red-600 py-3 text-sm font-bold text-white no-underline"
                >
                  {t("buildRoute")}
                </a>
                <a
                  href={`/showroom/${mapSr.slug}`}
                  className="flex flex-1 items-center justify-center rounded-xl border border-line bg-white py-3 text-sm font-semibold text-ink no-underline"
                >
                  {t("showroomPage")}
                </a>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
