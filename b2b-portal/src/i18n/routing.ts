import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["ru", "kk"],
  defaultLocale: "ru",
  // ru lives at "/", kk at "/kk/..." — mirrors hreflang expectations.
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];
