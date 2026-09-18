"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { Banner } from "@/lib/types";
import { PartnerLink } from "./WelcomeHeader";

const AUTOPLAY_MS = 6000;

/**
 * Full-width interior photo(s) with the headline and the partner button.
 * Without banners it still renders — on the panel colour with default copy.
 */
export function WelcomeHero({ banners }: { banners: Banner[] }) {
  const t = useTranslations("welcome");
  const [active, setActive] = useState(0);
  const count = banners.length;

  useEffect(() => {
    if (count < 2) return;
    const id = setInterval(() => setActive((current) => (current + 1) % count), AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [count]);

  const banner = banners[active] ?? null;
  const onPhoto = Boolean(banner?.image);

  return (
    <section className="relative isolate overflow-hidden bg-panel">
      {banners.map((item, index) =>
        item.image ? (
          <Image
            key={item.id}
            src={item.image}
            alt=""
            fill
            priority={index === 0}
            sizes="100vw"
            className={`-z-10 object-cover transition-opacity duration-700 ${index === active ? "opacity-100" : "opacity-0"}`}
          />
        ) : null,
      )}
      {onPhoto && <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/65 via-black/35 to-transparent" />}

      <div className="mx-auto flex min-h-[520px] max-w-[1400px] flex-col justify-center px-4 py-20 sm:px-6 lg:min-h-[640px] lg:px-10">
        <div className={`max-w-xl ${onPhoto ? "text-white" : "text-ink"}`}>
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] opacity-80">{t("eyebrow")}</p>
          <h1 className="font-display text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
            {banner?.title || t("heroTitle")}
          </h1>
          <p className="mt-5 text-lg opacity-90">{banner?.subtitle || t("heroSubtitle")}</p>
          <PartnerLink className="mt-8 inline-flex rounded-full bg-mint px-8 py-4 font-semibold text-mint-ink transition hover:opacity-90" />
        </div>

        {count > 1 && (
          <div className="mt-10 flex gap-2">
            {banners.map((item, index) => (
              <button
                key={item.id}
                type="button"
                aria-label={t("slide", { n: index + 1 })}
                aria-current={index === active}
                onClick={() => setActive(index)}
                className={`h-1.5 rounded-full transition-all ${
                  index === active
                    ? `w-10 ${onPhoto ? "bg-white" : "bg-ink"}`
                    : `w-5 ${onPhoto ? "bg-white/50" : "bg-ink/30"}`
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
