import type { Locale } from "../schemas/locale";

/*
 * Cache tag constants + helpers used with next/cache `revalidateTag`.
 * Centralised here so service files and any future ISR config share a single
 * source of truth for tag strings.
 *
 * Tags are LOCALE-SCOPED (Wave i18n-A): the public site renders one locale at
 * a time, so publishing the Arabic version of a playlist must not invalidate
 * the English homepage cache (and vice-versa).
 *
 * Naming convention: `<noun>:<scope>` collection tags, `<noun>:<locale>:<id>`
 * item tags.
 */

/** Published-playlists list on the homepage, scoped to a locale. */
export function playlistsHomeTag(locale: Locale): string {
  return `playlists:home:${locale}`;
}

/** A single playlist detail page, scoped to a locale + slug. */
export function playlistTag(locale: Locale, slug: string): string {
  return `playlist:${locale}:${slug}`;
}

/** All categories for a locale — invalidated whenever a category is mutated. */
export function categoriesTag(locale: Locale): string {
  return `categories:${locale}`;
}
