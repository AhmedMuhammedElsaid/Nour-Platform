import { defineRouting } from "next-intl/routing";

import { LOCALES, DEFAULT_LOCALE } from "@repo/api/schemas/locale";

/*
 * next-intl routing config (ADR 0001). Locales + default come from the single
 * source of truth in @repo/api so the data layer and the URL layer never drift.
 * `localePrefix: "always"` → every URL is /ar/... or /en/...; the root `/`
 * redirects by Accept-Language (handled by the middleware in proxy.ts).
 */
export const routing = defineRouting({
  locales: [...LOCALES],
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "always",
});
