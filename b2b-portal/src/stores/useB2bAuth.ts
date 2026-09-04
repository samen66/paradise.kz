"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ApiUser } from "@/lib/types";

interface B2BAuthState {
  token: string | null;
  user: ApiUser | null;
  setSession: (token: string, user: ApiUser) => void;
  setUser: (user: ApiUser) => void;
  clear: () => void;
}

export const useB2bAuth = create<B2BAuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setSession: (token, user) => set({ token, user }),
      setUser: (user) => set({ user }),
      clear: () => set({ token: null, user: null }),
    }),
    { name: "paradise-b2b-auth" },
  ),
);
