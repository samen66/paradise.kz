"use client";

import Image from "next/image";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { tValue } from "@/lib/format";
import type { B2bHomeCollection } from "@/lib/types";
import { useSignedIn } from "./useSignedIn";

/** One "style": interior cover + description, then its products without prices. */
export function StyleSection({ collection, reversed }: { collection: B2bHomeCollection; reversed: boolean }) {
  const t = useTranslations("welcome");
  const locale = useLocale();
  const signedIn = useSignedIn();

  return (
    <section className="mx-auto max-w-[1400px] px-4 py-14 sm:px-6 lg:px-10">
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <div className={`relative aspect-[4/3] overflow-hidden rounded-3xl bg-card ${reversed ? "lg:order-2" : ""}`}>
          {collection.cover ? (
            <Image src={collection.cover} alt={collection.title} fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
          ) : null}
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">{t("styleEyebrow")}</p>
          <h3 className="mt-3 font-display text-3xl font-semibold text-ink sm:text-4xl">{collection.title}</h3>
          {collection.description ? (
            <p className="mt-4 text-lg leading-relaxed text-muted">{collection.description}</p>
          ) : null}
          <Link
            href={signedIn ? "/catalog" : "/register"}
            className="mt-6 inline-flex text-sm font-semibold text-ink underline-offset-4 hover:underline"
          >
            {signedIn ? t("toCatalog") : t("seePrices")} →
          </Link>
        </div>
      </div>

      {collection.products.length > 0 && (
        <ul className="mt-10 grid grid-cols-2 gap-5 sm:grid-cols-4">
          {collection.products.map((product) => (
            <li key={product.id}>
              <Link href={signedIn ? `/product/${product.id}` : "/register"} className="group block">
                <div className="relative aspect-square overflow-hidden rounded-2xl bg-card">
                  {product.image ? (
                    <Image
                      src={product.images[0]?.medium ?? product.image}
                      alt={tValue(product.name, locale)}
                      fill
                      sizes="(min-width: 640px) 25vw, 50vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : null}
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-ink">{tValue(product.name, locale)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
