import React from "react";
import Link from "next/link";

interface ProductShort {
  id: number;
  cover: string;
  handle: string;
  views: string;
  href: string;
}

interface ProductShortsProps {
  shorts: ProductShort[];
}

export function ProductShorts({ shorts }: ProductShortsProps) {
  if (!shorts || shorts.length === 0) return null;

  return (
    <div className="py-2">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-gradient-to-br from-[#c8372f] to-[#e8894f]">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <path d="M8 5v14l11-7z" fill="#fff" />
          </svg>
        </span>
        <h2 className="font-display text-2xl font-bold tracking-tight text-ink">
          Видео с этим товаром
        </h2>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
        {shorts.map((short) => (
          <Link
            key={short.id}
            href={short.href}
            className="group relative block aspect-[9/16] w-[172px] shrink-0 overflow-hidden rounded-2xl bg-black shadow-[0_8px_24px_rgba(28,26,23,0.12)]"
          >
            <div
              className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
              style={{ backgroundImage: `url(${short.cover})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent to-[46%]" />
            <span className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 transition-colors group-hover:bg-red-600/90">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
            <div className="absolute bottom-3 left-3 right-3 text-white">
              <div className="text-[13px] font-bold drop-shadow-md">
                {short.handle}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[12px] opacity-90 drop-shadow-md">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff">
                  <path d="M8 5v14l11-7z" />
                </svg>
                {short.views}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
