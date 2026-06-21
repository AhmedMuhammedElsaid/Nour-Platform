import { defineRouting } from "next-intl/routing";

import { LOCALES, DEFAULT_LOCALE } from "@repo/api/schemas/locale";

/*
 * next-intl routing config (ADR 0001). Locales + default come from the single
 * source of truth in @repo/api so the data layer and the URL layer never drift.
 * `localePrefix: "always"` → every URL is /ar/... or /en/...; the root `/`
 * redirects to the default locale (Arabic). `localeDetection: false` makes
 * Arabic the product default for everyone — we deliberately do NOT follow the
 * browser's Accept-Language (an English-browser user still lands on /ar until
 * they switch), mirroring the mobile app's Arabic-first default (lib/i18n.ts).
 */
export const routing = defineRouting({
  locales: [...LOCALES],
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "always",
  localeDetection: false,
});
