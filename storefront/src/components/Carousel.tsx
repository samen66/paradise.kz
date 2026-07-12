"use client";

import { useRef, useState, useEffect } from "react";

export function Carousel({ children, itemWidth = 300 }: { children: React.ReactNode; itemWidth?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(true);

  const checkScroll = () => {
    if (!containerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = containerRef.current;
    setShowLeft(scrollLeft > 0);
    setShowRight(scrollLeft < scrollWidth - clientWidth - 10);
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, []);

  const scroll = (direction: "left" | "right") => {
    if (!containerRef.current) return;
    const amount = direction === "left" ? -itemWidth * 2 : itemWidth * 2;
    containerRef.current.scrollBy({ left: amount, behavior: "smooth" });
  };

  return (
    <div className="relative group">
      <div 
        ref={containerRef}
        onScroll={checkScroll}
        className="flex gap-5 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>

      {showLeft && (
        <button
          type="button"
          onClick={() => scroll("left")}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 hidden md:grid h-12 w-12 place-items-center rounded-full bg-white/95 shadow-md text-ink hover:bg-white opacity-0 transition-opacity group-hover:opacity-100 disabled:opacity-0"
          aria-label="Назад"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
      )}

      {showRight && (
        <button
          type="button"
          onClick={() => scroll("right")}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 hidden md:grid h-12 w-12 place-items-center rounded-full bg-white/95 shadow-md text-ink hover:bg-white opacity-0 transition-opacity group-hover:opacity-100 disabled:opacity-0"
          aria-label="Вперед"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      )}
    </div>
  );
}
