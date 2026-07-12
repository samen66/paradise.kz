"use client";

// Storefront customer session: Sanctum bearer token + user snapshot,
// persisted in localStorage (same model as the B2B SPA).

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ApiUser } from "./types";

interface AuthState {
  token: string | null;
  user: ApiUser | null;
  setSession: (token: string, user: ApiUser) => void;
  setUser: (user: ApiUser) => void;
  clear: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setSession: (token, user) => set({ token, user }),
      setUser: (user) => set({ user }),
      clear: () => set({ token: null, user: null }),
    }),
    { name: "paradise-auth" },
  ),
);
