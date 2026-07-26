// Cache identity for SERVER-SIDE content changes.
//
// The Quran queries carry `staleTime: Infinity` over a persisted query cache,
// and `runOfflinePrefetch`'s completion marker short-circuits on a match — so a
// change made purely in Atlas (no app code change) is invisible to an already
// installed build. Migration `0012-strip-ayah1-basmala` is exactly that case:
// it rewrites ayah 1's text for 112 surahs, and without a cache bust existing
// installs keep rendering the old double-Bismillah text indefinitely.
//
// ⚠️ Bumping `app.json` `expo.version` is NOT the fix. `runtimeVersion.policy`
// is `"appVersion"`, so raising the version changes the runtime version and the
// OTA update stops reaching the installed build entirely — it would then need a
// full `eas build` + store release to land. This constant lets a JS-only OTA
// invalidate cached content while the runtime version stays put.
//
// Bump on any server-side content change that already-cached clients must
// re-fetch. Keep it an integer; it is not a semver.
export const CONTENT_DATA_VERSION = 1;

/**
 * The persisted-cache `buster` AND the offline-prefetch marker version. These
 * two MUST stay the same string — a buster mismatch wipes the query cache, and
 * if the marker didn't also change, `runOfflinePrefetch` would early-return and
 * never refill it (see the OfflineMarker.version comment in offline-prefetch.ts).
 */
export function contentCacheBuster(appVersion: string): string {
  return `${appVersion}+data.${CONTENT_DATA_VERSION}`;
}
