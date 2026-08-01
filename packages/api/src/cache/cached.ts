import { unstable_cache } from "next/cache";

/*
 * Read-side activation for the tags declared in ./tags.
 *
 * The tags were already emitted by every mutation but nothing subscribed to
 * them, so every public page render hit Atlas cold. This module is the single
 * chokepoint that wraps public reads; the mutation side is unchanged.
 *
 * Three properties of Next's `unstable_cache` drive the shape of this module
 * (next/dist/server/web/spec-extension/unstable-cache.js):
 *
 * 1. The cache key is `cb.toString() + keyParts.join(",") + JSON.stringify(args)`
 *    (:55, :82). A callback that closes over its arguments stringifies
 *    identically for every argument value, so two different calls collide
 *    unless every result-changing argument appears in `keyParts`. Callers pass
 *    `keyParts` explicitly for exactly that reason — never rely on the closure.
 * 2. Entries are stored with `JSON.stringify` (:23) and read back with
 *    `JSON.parse` (:168, :243). A `Date` therefore survives a cache MISS as a
 *    `Date` and returns from a cache HIT as an ISO string. Any DTO carrying
 *    timestamps must pass through `reviveDates` after the cache boundary, or
 *    the same function returns two different runtime shapes depending on
 *    cache state.
 * 3. It throws `Invariant: incrementalCache missing` (:61) when invoked
 *    outside an App Router request. Only wrap reads that are reached from a
 *    page/route render — never from `scripts/*` or a migration.
 *
 * Hard rule: only session-free public reads may be wrapped. Anything gated by
 * `requireSession` or that branches on a caller's role stays uncached — a
 * cache key that omits the caller would serve one user's view to everyone.
 * Nothing wrapped here reads `headers()`/`cookies()`, which `unstable_cache`
 * forbids outright.
 */

/*
 * Editable content.
 *
 * ⚠️ Do NOT raise this on the assumption that `revalidateTag` will cover you.
 * It will not, for the public site. Every public-affecting mutation runs in
 * `apps/admin` (apps/web calls zero mutating services), and Next's data cache
 * is per-deployment — admin and web are separate Vercel projects with separate
 * stores. An admin publish therefore invalidates *admin's* cache while the
 * public site keeps serving the previous value until this TTL expires.
 *
 * So for apps/web this TTL is the primary invalidation mechanism, not a
 * backstop: five minutes is the worst-case staleness a reader sees after an
 * admin publish. Closing that gap needs a cross-deployment revalidation
 * webhook (admin → web) or a shared cache handler; until one exists, this
 * number is the guarantee.
 */
export const CONTENT_TTL_SECONDS = 300;

// Quran text, editions and reciters are immutable once seeded.
export const IMMUTABLE_TTL_SECONDS = 86_400;

export function cachedRead<T>(
  keyParts: readonly string[],
  tags: readonly string[],
  revalidate: number,
  read: () => Promise<T>,
): Promise<T> {
  return unstable_cache(read, [...keyParts], { tags: [...tags], revalidate })();
}

/*
 * `new Date(x)` accepts both a `Date` (cache miss) and the ISO string a cache
 * hit yields, and is idempotent over the former — so this runs safely on both
 * paths and normalises the return shape.
 */
export function reviveDates<T extends { createdAt: Date; updatedAt: Date }>(
  dto: T,
): T {
  return {
    ...dto,
    createdAt: new Date(dto.createdAt),
    updatedAt: new Date(dto.updatedAt),
  };
}
