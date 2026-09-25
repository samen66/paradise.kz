'use client';

import { useEffect, useRef } from 'react';

/** Невидимая полоска в конце списка: доехали до неё прокруткой — `onVisible`. */
export default function LoadMoreSentinel({ onVisible, disabled }: { onVisible: () => void; disabled: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || disabled) {
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        onVisible();
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [onVisible, disabled]);

  return <div ref={ref} className="h-6" aria-hidden="true" />;
}
