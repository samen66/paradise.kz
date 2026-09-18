"use client";

import { useB2bAuth } from "@/stores/useB2bAuth";

/** Sections that buy: closed until a manager approves the client. */
export const APPROVED_ONLY_PATHS = ["/cart", "/checkout", "/quick-order", "/orders"] as const;

export function isApprovedOnlyPath(pathname: string): boolean {
  return APPROVED_ONLY_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function useIsApproved(): boolean {
  return useB2bAuth((state) => state.user?.is_approved === true);
}
