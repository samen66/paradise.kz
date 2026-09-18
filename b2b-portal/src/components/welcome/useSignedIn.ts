"use client";

import { useEffect, useState } from "react";
import { useB2bAuth } from "@/stores/useB2bAuth";

/**
 * Signed-in state after hydration. The token lives in localStorage, so the
 * server render (and the first client render) always show the guest view.
 */
export function useSignedIn(): boolean {
  const token = useB2bAuth((state) => state.token);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
  }, []);

  return isMounted && token !== null;
}
