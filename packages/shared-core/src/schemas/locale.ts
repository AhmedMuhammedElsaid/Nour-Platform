import { z } from "zod";

/*
 * Single source of truth for the platform's content + UI locales.
 * Arabic is the default (Islamic content platform; AR is the primary audience).
 * See ADR 0001 (next-intl chrome) and DATABASE.md §3 (per-locale content docs).
 *
 * Apps import `LOCALES`/`DEFAULT_LOCALE` for routing config; services import
 * `localeSchema`/`Locale` to validate the `locale` discriminator on every
 * content document.
 */
export const LOCALES = ["ar", "en"] as const;
export const DEFAULT_LOCALE: Locale = "ar";

export const localeSchema = z.enum(LOCALES);
export type Locale = z.infer<typeof localeSchema>;

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}
