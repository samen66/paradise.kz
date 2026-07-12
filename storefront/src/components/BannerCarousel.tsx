"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { Banner } from "@/lib/types";

const AUTOPLAY_MS = 6000;

export function BannerCarousel({ banners }: { banners: Banner[] }) {
  const t = useTranslations("common");
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = banners.length;

  useEffect(() => {
    if (count < 2 || paused) return;
    const id = setInterval(() => {
      setActive((current) => (current + 1) % count);
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [count, paused]);

  if (count === 0) return null;

  return (
    <div
      className="relative overflow-hidden rounded-2xl bg-panel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="grid min-h-[480px] md:grid-cols-[1fr_1.2fr] lg:min-h-[70vh]">
        <div className="flex flex-col justify-center gap-5 px-8 py-12 sm:px-12 lg:px-16 z-20 relative bg-panel">
          {banners[active].title ? (
            <h2 className="font-display text-3xl font-semibold tracking-tight text-ink lg:text-[42px] leading-[1.15] animate-[fade-in_0.3s_ease-out]">
              {banners[active].title}
            </h2>
          ) : null}
          {banners[active].subtitle ? (
            <p className="max-w-md text-base lg:text-lg text-muted animate-[fade-in_0.4s_ease-out]">
              {banners[active].subtitle}
            </p>
          ) : null}
          {banners[active].url ? (
            <a
              href={banners[active].url!}
              className="mt-2 inline-flex w-fit items-center gap-2 rounded-xl bg-ink px-6 py-3.5 text-base font-medium text-white transition hover:bg-ink-hover active:scale-[0.98] animate-[fade-in_0.5s_ease-out]"
            >
              {t("buy")}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true" className="h-4 w-4">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </a>
          ) : null}

          {count > 1 ? (
            <div className="mt-8 flex gap-2">
              {banners.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  aria-label={item.title ? `${item.title} — ${index + 1}` : `${index + 1}`}
                  aria-current={index === active}
                  onClick={() => setActive(index)}
                  className={`h-2 rounded-full transition-all duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                    index === active ? "w-8 bg-ink" : "w-2 bg-ink/20 hover:bg-ink/40"
                  }`}
                />
              ))}
            </div>
          ) : null}
        </div>

        <div className="relative min-h-64 md:min-h-0 bg-card overflow-hidden">
          {banners.map((banner, index) => (
            <div
              key={banner.id}
              className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                index === active ? "opacity-100 z-10" : "opacity-0 z-0"
              }`}
            >
              {banner.image ? (
                <Image
                  src={banner.image}
                  alt={banner.title ?? ""}
                  fill
                  priority={index === 0}
                  sizes="(max-width: 768px) 100vw, 60vw"
                  className="object-cover"
                />
              ) : null}
            </div>
          ))}

          <div className="absolute bottom-6 right-6 z-20 flex h-20 w-20 flex-col items-center justify-center rounded-full bg-white/95 text-center shadow-lg backdrop-blur-sm animate-[scale-in_0.5s_ease-out_0.2s_both]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="mb-1 h-6 w-6 text-ink">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
            </svg>
            <span className="text-[10px] font-semibold leading-tight text-ink uppercase">В наличии</span>
          </div>
        </div>
      </div>
    </div>
  );
}
