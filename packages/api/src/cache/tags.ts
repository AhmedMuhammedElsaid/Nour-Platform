/*
 * Cache tag constants used with next/cache `revalidateTag`.
 * Centralised here so that service files and any future ISR config share
 * a single source of truth for tag strings.
 *
 * Tag naming convention: plural-noun for collection-level tags,
 * `<noun>:<identifier>` for item-level tags (e.g. `playlist:<slug>`).
 */

/** Tags the full published-playlists list on the homepage. */
export const PLAYLISTS_HOME = "playlists:home" as const;

/** Tags all categories — invalidated whenever a category is mutated. */
export const CATEGORIES = "categories" as const;
