// Repo-owned preview provider for design-sync. Wraps components that need
// next-intl + Next App Router context to render outside a running Next app.
// Referenced by .design-sync/config.json's `provider` + `extraEntries`.
"use client";

// Several of Next's own client internals (e.g. dist/client/has-base-path.js,
// pulled in transitively by next/link and next-intl's Link) read
// `process.env.*` at module top-level. Webpack shims this at build time;
// esbuild (used here) doesn't, so the bare `process` global is otherwise
// undefined in the browser and throws on first access. This module is
// listed first in cfg.extraEntries, and the generated bundle entry does
// `export * from <extraEntries>` before `export * from <mainEntry>` — ESM
// evaluates the first branch's whole dependency graph before the second
// starts, so this shim lands before anything that needs it.
if (typeof globalThis !== "undefined" && typeof (globalThis as unknown as { process?: unknown }).process === "undefined") {
  (globalThis as unknown as { process: { env: Record<string, string> } }).process = { env: {} };
}

import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import {
  PathnameContext,
  SearchParamsContext,
} from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import messages from "@/messages/ru.json";

const mockRouter = {
  push: () => {},
  replace: () => {},
  refresh: () => {},
  back: () => {},
  forward: () => {},
  prefetch: () => {},
};

export function PreviewProviders({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="ru" messages={messages}>
      <AppRouterContext.Provider value={mockRouter}>
        <PathnameContext.Provider value="/">
          <SearchParamsContext.Provider value={new URLSearchParams()}>
            {children}
          </SearchParamsContext.Provider>
        </PathnameContext.Provider>
      </AppRouterContext.Provider>
    </NextIntlClientProvider>
  );
}
