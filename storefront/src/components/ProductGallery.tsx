"use client";

import { useState } from "react";
import Image from "next/image";
import type { ProductImage } from "@/lib/types";

export function ProductGallery({ images, alt }: { images: ProductImage[]; alt: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[activeIndex] ?? images[0];

  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-card">
        {active ? (
          <Image
            src={active.full}
            alt={alt}
            fill
            preload
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-contain p-6 sm:p-10"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-black/5 text-muted" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-16 h-16 opacity-50">
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
            </svg>
          </div>
        )}
      </div>

      {images.length > 1 ? (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {images.map((image, index) => (
            <button
              key={`${index}-${image.thumb}`}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={`${alt} — ${index + 1}`}
              aria-pressed={index === activeIndex}
              className={`relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl border-2 bg-card transition ${
                index === activeIndex ? "border-ink" : "border-line hover:border-line-strong"
              }`}
            >
              <Image src={image.thumb} alt="" fill sizes="80px" className="object-contain p-1.5" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
