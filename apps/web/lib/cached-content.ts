import { unstable_cache } from "next/cache";

import { PLAYLISTS_HOME, CATEGORIES, playlistTag } from "@repo/api/cache/tags";
import {
  getPublishedPlaylists,
  getPlaylistBySlug,
} from "@repo/api/services/playlist";
import { listCategories } from "@repo/api/services/category";
import { getTracksWithUrls } from "@repo/api/services/track";
import type { Locale } from "@repo/api/schemas/locale";

/*
 * Data-cache tier for the public web app.
 *
 * Pages stay force-dynamic (per-request CSP nonce), but these reads resolve
 * from Next's data cache instead of hitting Atlas on every request. Each entry
 * carries the same tag @repo/api's invalidate() busts, plus revalidate: 300 as
 * the self-healing fallback for a missed cross-deployment webhook.
 *
 * Tags mirror what the services invalidate:
 *   - playlist publish/unpublish/update/delete/reorder bust PLAYLISTS_HOME,
 *     so the home list AND the by-slug lookup carry PLAYLISTS_HOME.
 *   - track create/update/delete/reorder bust playlistTag(playlistId), so the
 *     per-playlist track list carries that exact tag (NOT PLAYLISTS_HOME).
 *   - category mutations bust CATEGORIES.
 *
 * unstable_cache keys on keyParts + the serialized call args, so distinct
 * filters/slugs/ids get distinct entries. Date fields may round-trip as ISO
 * strings on a cache hit; every consumer already tolerates Date | string.
 */
const TTL = 300;

export function getCachedPublishedPlaylists(categoryId?: string) {
  return unstable_cache(
    (cat?: string) =>
      getPublishedPlaylists(cat != null ? { categoryId: cat } : undefined),
    ["published-playlists"],
    { tags: [PLAYLISTS_HOME], revalidate: TTL },
  )(categoryId);
}

export function getCachedCategories() {
  return unstable_cache(() => listCategories(), ["categories"], {
    tags: [CATEGORIES],
    revalidate: TTL,
  })();
}

export function getCachedPlaylistBySlug(locale: Locale, slug: string) {
  return unstable_cache(
    (l: Locale, s: string) => getPlaylistBySlug(l, s),
    ["playlist-by-slug"],
    { tags: [PLAYLISTS_HOME], revalidate: TTL },
  )(locale, slug);
}

export function getCachedTracksWithUrls(playlistId: string) {
  // Tagged with the per-playlist tag that track mutations actually bust.
  return unstable_cache(
    (id: string) => getTracksWithUrls(id),
    ["tracks-with-urls"],
    { tags: [playlistTag(playlistId)], revalidate: TTL },
  )(playlistId);
}
