/*
 * Upstash Redis credentials (ADR 0015 — rate limiting).
 *
 * Why this lives beside `./env` instead of inside it: `./env` calls
 * `parseEnv()` at module load, so importing it from anything reachable during
 * `next build` crashes the build when MONGODB_URI/AUTH_SECRET aren't set
 * (see the comments in apps/web/lib/cors.ts and next.config.ts). The rate
 * limiter is imported by every /api/v1 route module, which Next evaluates while
 * collecting page data — so its credential read MUST be lazy.
 *
 * `process.env` access is still confined to `packages/config` (CLAUDE.md §5);
 * it just happens inside a function rather than at import time. The two vars
 * are additionally declared `.optional()` in ./env so the canonical env list
 * stays complete for anyone reading it.
 */

export interface UpstashCredentials {
  readonly url: string;
  readonly token: string;
}

/**
 * Returns the Upstash REST credentials, or `null` when either is unset/blank.
 *
 * `null` is a normal, expected state — local dev, CI and any deploy that has
 * not provisioned Upstash. Callers must treat it as "feature disabled", never
 * as an error: the rate limiter is an availability guard, and refusing to boot
 * without it would invert its purpose.
 *
 * The names match what the Vercel↔Upstash integration injects, so a connected
 * project needs no manual mapping.
 */
export function readUpstashCredentials(): UpstashCredentials | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  return { url, token };
}
