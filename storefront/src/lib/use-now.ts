"use client";

import { useEffect, useState } from "react";

/**
 * The visitor's clock, ticking every minute. null during SSR and the first
 * client render, so "open now" never differs between server and browser.
 */
export function useNow(): Date | null {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  return now;
}
