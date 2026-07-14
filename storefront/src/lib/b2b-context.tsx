"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { ApiUser } from "./types";

interface B2BContextValue {
  isB2B: true;
  token: string;
  user: ApiUser;
}

const B2BContext = createContext<B2BContextValue | null>(null);

export function useB2B(): B2BContextValue | null {
  return useContext(B2BContext);
}

export function B2BProvider({
  token,
  user,
  children,
}: {
  token: string;
  user: ApiUser;
  children: ReactNode;
}) {
  return (
    <B2BContext.Provider value={{ isB2B: true, token, user }}>
      {children}
    </B2BContext.Provider>
  );
}
