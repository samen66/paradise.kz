"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { OpenBadge } from "@/components/showrooms/OpenStatus";
import { DAY_KEYS, dayIndex, mapUrl, routeUrl, scheduleRows, telHref, whatsappUrl } from "@/lib/showrooms";
import type { Showroom } from "@/lib/types";
import { useNow } from "@/lib/use-now";

export function ShowroomClient({ showroom: s }: { showroom: Showroom }) {
  const t = useTranslations("showrooms");
  const now = useNow();
  const [photo, setPhoto] = useState(0);

  const today = now ? dayIndex(now) : -1;
  const route = routeUrl(s);
  const map = mapUrl(s);
  const whatsapp = whatsappUrl(s.whatsapp);
  const facts = [s.area, s.floors, s.parking].filter(Boolean).join(" · ");
  const dayLabel = (index: number) => t(`days.${DAY_KEYS[index]}`);

  return (
    <div className="mx-auto max-w-[1360px] px-4 pb-10 pt-[18px] sm:px-8">
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[1.35fr_1fr]">
        <div>
          <div
            className="relative overflow-hidden rounded-2xl border border-line bg-card bg-cover bg-center"
            style={{ aspectRatio: "16/10", ...(s.photos[photo] ? { backgroundImage: `url(${s.photos[photo].wide})` } : {}) }}
          >
            {s.is_flagship && (
              <span className="absolute left-3.5 top-3.5 inline-flex items-center rounded-full bg-ink/80 px-3 py-1.5 text-xs font-bold text-white">
                {t("flagshipLong")}
              </span>
            )}
          </div>
          {s.photos.length > 1 && (
            <div className="mt-3 grid grid-cols-4 gap-3">
              {s.photos.map((p, i) => (
                <button
                  key={p.card}
                  type="button"
                  aria-label={`${i + 1}`}
                  onClick={() => setPhoto(i)}
                  className={`cursor-pointer overflow-hidden rounded-xl border-2 bg-card bg-cover bg-center p-0 ${i === photo ? "border-red-600" : "border-transparent"}`}
                  style={{ aspectRatio: "1/1", backgroundImage: `url(${p.card})` }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-line bg-white p-6 shadow-sm sm:p-7">
            <div className="mb-1.5 flex items-start justify-between gap-3">
              <h1 className="m-0 font-display text-[26px] font-bold leading-tight tracking-tight text-ink">{s.name}</h1>
              <OpenBadge hours={s.weekly_hours} withSubtitle />
            </div>
            {s.city && <div className="mb-4 text-[13px] text-muted">{s.city}</div>}

            <div className="flex flex-col gap-2.5 border-b border-line pb-4 text-sm text-ink/80">
              {s.address && (
                <div>
                  <b className="font-semibold text-ink">{s.address}</b>
                  {s.landmark && <div className="text-muted">{s.landmark}</div>}
                </div>
              )}
              {facts && <div>{facts}</div>}
              {s.phone && (
                <a href={telHref(s.phone)} className="font-semibold text-ink no-underline">
                  {s.phone}
                </a>
              )}
            </div>

            <div className="my-4 flex flex-wrap gap-2.5">
              {route && (
                <a href={route} target="_blank" rel="noopener noreferrer" className="flex min-w-[180px] flex-1 items-center justify-center rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white no-underline hover:bg-red-700">
                  {t("route")}
                </a>
              )}
              {map && (
                <a href={map} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center rounded-xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink no-underline hover:border-ink/30">
                  {t("openIn2gis")}
                </a>
              )}
              {whatsapp && (
                <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center rounded-xl border border-line bg-white px-4 py-3 text-sm font-semibold text-[#1d6b4f] no-underline hover:border-ink/30">
                  {t("whatsapp")}
                </a>
              )}
            </div>

            {s.services.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {s.services.map((service) => (
                  <span key={service} className="inline-flex items-center rounded-full bg-surface px-[11px] py-1 text-[12.5px] text-ink/80">
                    ✓ {t(`services.${service}`)}
                  </span>
                ))}
              </div>
            )}

            {s.description && <p className="mb-0 mt-4 whitespace-pre-line text-sm leading-relaxed text-ink/80">{s.description}</p>}
          </div>

          <div className="rounded-2xl border border-line bg-white px-6 py-5 shadow-sm sm:px-7">
            <h2 className="m-0 mb-3.5 font-display text-base font-bold text-ink">{t("hours")}</h2>
            {scheduleRows(s.weekly_hours).map((row) => {
              const isToday = today >= row.from && today <= row.to;
              const range = row.from === row.to ? dayLabel(row.from) : `${dayLabel(row.from)}–${dayLabel(row.to)}`;
              return (
                <div
                  key={row.from}
                  className={`flex items-center justify-between gap-3 border-b border-dashed border-line py-2 text-sm last:border-0 ${row.hours ? "text-ink" : "text-muted"} ${isToday ? "font-bold" : ""}`}
                >
                  <span>
                    {range}
                    {isToday && <span className="ml-2 rounded-full bg-red-600/10 px-2 py-0.5 text-[11px] font-bold text-red-600">{t("today")}</span>}
                  </span>
                  <span>{row.hours ? `${row.hours.open}–${row.hours.close}` : t("dayOff")}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
