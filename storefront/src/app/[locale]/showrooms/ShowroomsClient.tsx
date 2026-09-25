"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { OpenBadge, TodayLine } from "@/components/showrooms/OpenStatus";
import { mapUrl, routeUrl, telHref, whatsappUrl } from "@/lib/showrooms";
import type { Showroom } from "@/lib/types";

const PREVIEW = 5;

export function ShowroomsClient({ showrooms, contactPhone }: { showrooms: Showroom[]; contactPhone: string | null }) {
  const t = useTranslations("showrooms");
  const [city, setCity] = useState<string | null>(null);

  const cities = Array.from(new Set(showrooms.map((s) => s.city).filter((c): c is string => Boolean(c))));
  const list = city ? showrooms.filter((s) => s.city === city) : showrooms;

  const chip = (active: boolean) =>
    `inline-flex cursor-pointer items-center gap-[7px] whitespace-nowrap rounded-full border px-4 py-2 font-sans text-sm font-semibold transition-colors ${
      active ? "border-ink bg-ink text-white" : "border-line bg-white text-ink/80 hover:border-ink/30"
    }`;

  return (
    <>
      <div className="mx-auto max-w-[1360px] px-4 pt-[18px] sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="m-0 font-display text-[28px] font-extrabold tracking-tight text-ink sm:text-[34px]">{t("title")}</h1>
            <p className="mt-2 max-w-[560px] text-[15px] leading-relaxed text-muted">{t("lead")}</p>
          </div>
          {showrooms.length > 0 && (
            <div className="flex shrink-0 gap-[26px]">
              <div>
                <div className="font-display text-[26px] font-bold text-ink">{showrooms.length}</div>
                <div className="text-[13px] text-muted">{t("count", { count: showrooms.length })}</div>
              </div>
              {cities.length > 0 && (
                <div>
                  <div className="font-display text-[26px] font-bold text-ink">{cities.length}</div>
                  <div className="text-[13px] text-muted">{t("cities", { count: cities.length })}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {cities.length > 1 && (
          <div className="mt-[22px] flex flex-wrap items-center gap-2">
            <span className="mr-0.5 text-[13px] font-semibold text-muted">{t("city")}</span>
            <button type="button" onClick={() => setCity(null)} className={chip(city === null)}>
              {t("allCities")}
              <span className="text-[12px] font-semibold opacity-65">{showrooms.length}</span>
            </button>
            {cities.map((c) => (
              <button key={c} type="button" onClick={() => setCity(c)} className={chip(city === c)}>
                {c}
                <span className="text-[12px] font-semibold opacity-65">{showrooms.filter((s) => s.city === c).length}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mx-auto max-w-[1360px] px-4 pb-16 pt-[22px] sm:px-8">
        {showrooms.length === 0 ? (
          <div className="rounded-2xl border border-line bg-white p-12 text-center text-muted">
            {t("empty")}{" "}
            {contactPhone && (
              <a href={telHref(contactPhone)} className="font-semibold text-ink">
                {contactPhone}
              </a>
            )}
          </div>
        ) : (
          <>
            <div className="mb-4 text-sm text-muted">{t("found", { count: list.length })}</div>
            <div className="grid grid-cols-1 gap-[18px] xl:grid-cols-2">
              {list.map((s) => (
                <ShowroomCard key={s.id} showroom={s} />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}

function ShowroomCard({ showroom: s }: { showroom: Showroom }) {
  const t = useTranslations("showrooms");
  const detailHref = `/showrooms/${s.slug}`;
  const route = routeUrl(s);
  const map = mapUrl(s);
  const whatsapp = whatsappUrl(s.whatsapp);
  const more = Math.max(0, s.products_count - s.products_preview.length);

  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm transition-colors hover:border-ink/20">
      <div className="grid grid-cols-1 sm:grid-cols-[188px_1fr]">
        <Link
          href={detailHref}
          className="relative block min-h-[180px] bg-card bg-cover bg-center no-underline"
          style={s.photos[0] ? { backgroundImage: `url(${s.photos[0].card})` } : undefined}
        >
          {s.is_flagship && (
            <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-ink/80 px-[9px] py-1 text-[11px] font-bold text-white">
              {t("flagship")}
            </span>
          )}
        </Link>

        <div className="flex min-w-0 flex-col gap-3 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link href={detailHref} className="no-underline">
                <h2 className="m-0 font-display text-[19px] font-bold leading-tight tracking-tight text-ink">{s.name}</h2>
              </Link>
              {s.city && <div className="mt-1 text-[13px] text-muted">{s.city}</div>}
            </div>
            <OpenBadge hours={s.weekly_hours} />
          </div>

          <div className="flex flex-col gap-1.5 text-[13.5px] text-ink/80">
            {s.address && (
              <div>
                {s.address}
                {s.landmark && <span className="text-muted"> · {s.landmark}</span>}
              </div>
            )}
            <TodayLine hours={s.weekly_hours} />
          </div>

          {s.services.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {s.services.slice(0, 3).map((service) => (
                <span key={service} className="rounded-full bg-surface px-2.5 py-1 text-xs text-ink/80">
                  {t(`services.${service}`)}
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {route && (
              <a href={route} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-full bg-ink px-[15px] py-[9px] text-[13px] font-semibold text-white no-underline hover:bg-ink/90">
                {t("route")}
              </a>
            )}
            {s.phone && (
              <a href={telHref(s.phone)} className="inline-flex items-center rounded-full border border-line bg-white px-[15px] py-[9px] text-[13px] font-semibold text-ink no-underline hover:border-ink/30">
                {s.phone}
              </a>
            )}
            {whatsapp && (
              <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-full border border-line bg-white px-[13px] py-[9px] text-[13px] font-semibold text-[#1d6b4f] no-underline hover:border-ink/30">
                {t("whatsapp")}
              </a>
            )}
            {map && (
              <a href={map} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-2 py-[9px] text-[13px] font-semibold text-red-600 no-underline hover:text-red-700">
                {t("onMap")}
              </a>
            )}
          </div>

          {s.products_count > 0 && (
            <div className="mt-1.5 border-t border-line pt-3.5">
              <div className="mb-2.5 flex items-center justify-between gap-3">
                <span className="text-[13px] font-semibold text-ink">{t("productsHere", { count: s.products_count })}</span>
                <Link href={detailHref} className="whitespace-nowrap text-[13px] font-semibold text-red-600 no-underline hover:text-red-700">
                  {t("seeAll")}
                </Link>
              </div>
              <div className="flex flex-wrap items-center gap-[9px]">
                {s.products_preview.slice(0, PREVIEW).map((p) => (
                  <Link
                    key={p.id}
                    href={`/product/${p.slug ?? p.id}`}
                    title={p.name}
                    className="block h-[58px] w-[58px] shrink-0 overflow-hidden rounded-xl border border-line bg-card bg-cover bg-center no-underline"
                    style={p.image ? { backgroundImage: `url(${p.image})` } : undefined}
                  />
                ))}
                {more > 0 && (
                  <Link
                    href={detailHref}
                    className="flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-xl border border-dashed border-line bg-surface text-[13px] font-bold text-muted no-underline hover:border-ink/30 hover:text-ink"
                  >
                    +{more}
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
