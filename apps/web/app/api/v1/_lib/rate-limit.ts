import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { readUpstashCredentials } from "@repo/config/upstash";

/*
 * Public-API rate limiting (ADR 0015).
 *
 * Consumed only by `./respond`'s `apiRoute()` wrapper — routes never call into
 * this module directly, they just declare their class. Keeping the enforcement
 * in one place is the point: a route cannot forget the Retry-After header or
 * invent a different 429 body.
 *
 * Two invariants this module exists to guarantee, both asserted in
 * ./rate-limit.test.ts:
 *
 *  1. FAIL OPEN. A limiter fault — no credentials, unreachable Redis, slow
 *     Redis, malformed response — always resolves to "allowed". This is a
 *     public content site; a limiter outage must never become a site outage.
 *     There is deliberately no code path here that can produce a non-2xx
 *     response because of an infrastructure problem.
 *  2. NO SHARED FALLBACK BUCKET. If the client IP cannot be determined the
 *     request is not limited, rather than being counted against a single
 *     "unknown" key. A shared key would let one unattributable request stream
 *     lock out every other unattributable client — turning a missing header
 *     into a denial of service against real users.
 */

export type ApiRouteClass =
  | "search"
  | "tafsir"
  | "quran-page"
  | "now-playing"
  | "catalog"
  | "static";

interface WindowConfig {
  /** Requests permitted per window, per client IP. */
  readonly limit: number;
  readonly windowSeconds: number;
}

/*
 * Ceilings on pathological traffic, not throttles on real use — each sits about
 * an order of magnitude above realistic human interaction with the screen it
 * backs, so a legitimate reader should never see a 429. Ordered cheapest-to-run
 * last. Rationale per class is in ADR 0015; tune from real traffic once Upstash
 * analytics exist.
 */
export const ROUTE_LIMITS: Record<ApiRouteClass, WindowConfig> = {
  // Mongo $text scan on attacker-chosen input, uncacheable by construction.
  search: { limit: 20, windowSeconds: 60 },
  // Per-ayah document read; 6,236 distinct keys is enough to walk the cache.
  tafsir: { limit: 30, windowSeconds: 60 },
  // Opens an OUTBOUND socket to a third party. Clients poll one station at
  // ~2-3/min, so this leaves headroom for switching stations and retries.
  "now-playing": { limit: 30, windowSeconds: 60 },
  // Largest single payload in the API (a full mushaf page with word rows).
  "quran-page": { limit: 60, windowSeconds: 60 },
  // DB-backed but unstable_cache-fronted. `?category=` is the unique-URL CDN
  // bypass, which is why the catalog needs a real ceiling at all.
  catalog: { limit: 60, windowSeconds: 60 },
  // Immutable seeded content on a 24h cache TTL — near-free to serve. This is
  // an anti-runaway backstop, not a cost control.
  static: { limit: 120, windowSeconds: 60 },
};

export type RateLimitVerdict =
  | { readonly allowed: true }
  | {
      readonly allowed: false;
      readonly limit: number;
      readonly remaining: number;
      /** Epoch ms at which the window resets (Upstash `reset`). */
      readonly resetAt: number;
      readonly retryAfterMs: number;
    };

const ALLOWED: RateLimitVerdict = { allowed: true };

/*
 * Platform-set headers first. Vercel strips `x-vercel-forwarded-for` and
 * `x-real-ip` from the incoming request and re-sets them from the real socket,
 * so a client cannot forge them. `x-forwarded-for` is the last resort (non-Vercel
 * hosting); its first entry is the conventional client position there.
 */
const IP_HEADERS = ["x-vercel-forwarded-for", "x-real-ip", "x-forwarded-for"] as const;

// Longest possible textual IPv6 address ("…:255.255.255.255" form) is 45 chars.
// Anything longer is garbage or a padding attack: reject it rather than truncate,
// because truncating would collapse distinct clients onto one shared key.
const MAX_IP_LENGTH = 45;

/**
 * Derives the rate-limit key for a request, or `null` when no usable client IP
 * is present (local dev, unit tests, a non-proxied deployment). `null` means
 * "do not limit" — see invariant 2 at the top of this file.
 */
export function clientIpFromHeaders(headers: Headers): string | null {
  for (const name of IP_HEADERS) {
    const raw = headers.get(name);
    if (raw == null) continue;
    const first = raw.split(",")[0]?.trim();
    if (!first || first.length > MAX_IP_LENGTH) continue;
    return first.toLowerCase();
  }
  return null;
}

/**
 * `Retry-After` is defined in whole seconds (RFC 9110 §10.2.3), and must be at
 * least 1 — a `Retry-After: 0` invites an immediate retry that is still blocked.
 */
export function retryAfterSeconds(retryAfterMs: number): number {
  return Math.max(1, Math.ceil(retryAfterMs / 1000));
}

/**
 * Headers for a 429. Emitted ONLY on the rejection, never alongside a 200:
 * `jsonOk` sets `Cache-Control: public, max-age=60`, so a shared cache that
 * captured an `X-RateLimit-Remaining` would be describing a stranger's budget.
 * `no-store` is included for the same reason — a cached 429 would turn one
 * client's block into everyone's outage.
 */
export function rateLimitHeaders(verdict: Extract<RateLimitVerdict, { allowed: false }>): Record<string, string> {
  return {
    "Retry-After": String(retryAfterSeconds(verdict.retryAfterMs)),
    "X-RateLimit-Limit": String(verdict.limit),
    "X-RateLimit-Remaining": String(Math.max(0, verdict.remaining)),
    "X-RateLimit-Reset": String(Math.ceil(verdict.resetAt / 1000)),
    "Cache-Control": "no-store",
  };
}

/**
 * Maps a raw Upstash `limit()` result to a verdict. Pure — this is the decision
 * logic, split out so it can be tested without a Redis.
 */
export function verdictFromResult(
  result: { success: boolean; limit: number; remaining: number; reset: number },
  nowMs: number,
): RateLimitVerdict {
  if (result.success) return ALLOWED;
  return {
    allowed: false,
    limit: result.limit,
    remaining: result.remaining,
    resetAt: result.reset,
    retryAfterMs: Math.max(0, result.reset - nowMs),
  };
}

/*
 * Upstash's own timeout: if Redis has not answered within this budget the call
 * resolves as ALLOWED rather than rejecting. Sized to stay well under any
 * plausible client timeout — the worst case a reader can experience from the
 * limiter is this much added latency, once per window per identifier (the
 * ephemeral cache short-circuits repeats within the instance).
 */
const REDIS_TIMEOUT_MS = 800;

// Instance-local memory of already-blocked identifiers, so a client hammering
// the API costs one Redis round trip per window rather than one per request.
const ephemeralCache = new Map<string, number>();

let limiters: Map<ApiRouteClass, Ratelimit> | null = null;
let credentialsMissingWarned = false;
let lastFaultLoggedAt = 0;
const FAULT_LOG_INTERVAL_MS = 60_000;

/*
 * Lazily builds one Ratelimit per class over a single shared Redis client, and
 * returns null forever once credentials are found to be absent. Lazy because
 * this module is imported by every /api/v1 route, which Next evaluates while
 * collecting page data during `next build` — reading credentials at import time
 * would tie the build to an env var that is legitimately unset.
 */
function getLimiters(): Map<ApiRouteClass, Ratelimit> | null {
  if (limiters !== null) return limiters;

  const credentials = readUpstashCredentials();
  if (credentials === null) {
    if (!credentialsMissingWarned) {
      credentialsMissingWarned = true;
      // Once per process, not once per request: this is the normal state in
      // local dev and CI, and per-request logging would bury real warnings.
      console.warn(
        "[rate-limit] UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN are unset — API rate limiting is DISABLED. See docs/adr/0015-upstash-ratelimit.md.",
      );
    }
    return null;
  }

  const redis = new Redis({ url: credentials.url, token: credentials.token });
  const built = new Map<ApiRouteClass, Ratelimit>();
  for (const [routeClass, config] of Object.entries(ROUTE_LIMITS)) {
    built.set(
      // Object.entries widens the key to string; the source is ROUTE_LIMITS,
      // whose keys are exactly ApiRouteClass. Adapter boundary (CLAUDE.md §4).
      routeClass as ApiRouteClass,
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(config.limit, `${config.windowSeconds} s`),
        prefix: `nour:rl:${routeClass}`,
        // Upstash analytics costs extra commands per request against the free
        // tier's daily budget; the 429 rate is observable from platform logs.
        analytics: false,
        timeout: REDIS_TIMEOUT_MS,
        ephemeralCache,
      }),
    );
  }
  limiters = built;
  return limiters;
}

function logFault(error: unknown): void {
  const now = Date.now();
  if (now - lastFaultLoggedAt < FAULT_LOG_INTERVAL_MS) return;
  lastFaultLoggedAt = now;
  console.warn("[rate-limit] limiter unavailable, serving request unlimited (fail-open):", error);
}

/**
 * The enforcement entry point. Resolves to a verdict; never throws.
 *
 * Returns `allowed` — i.e. fails open — when the limiter is disabled, when no
 * client IP can be derived, and when Redis errors out or times out.
 */
export async function checkRateLimit(
  routeClass: ApiRouteClass,
  headers: Headers,
): Promise<RateLimitVerdict> {
  const active = getLimiters();
  if (active === null) return ALLOWED;

  const ip = clientIpFromHeaders(headers);
  if (ip === null) return ALLOWED;

  const limiter = active.get(routeClass);
  if (limiter === undefined) return ALLOWED;

  try {
    const result = await limiter.limit(ip);
    return verdictFromResult(result, Date.now());
  } catch (error) {
    // Fail open. Any fault — network, auth, quota, malformed response — is
    // logged (throttled) and the request is served.
    logFault(error);
    return ALLOWED;
  }
}

/** Test-only: clears the lazy singletons so credentials can be re-read. */
export function resetRateLimiterForTests(): void {
  limiters = null;
  credentialsMissingWarned = false;
  lastFaultLoggedAt = 0;
  ephemeralCache.clear();
}
