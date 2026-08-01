import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Rate-limiter decision logic (ADR 0015).
 *
 * The Upstash SDK is mocked wholesale — these tests must never need a live
 * Redis, and CI has no credentials. What is under test is our behaviour around
 * the SDK: the fail-open guarantees, the IP-derivation rules, the verdict/header
 * shape, and the end-to-end 429 that `apiRoute` produces from a limiter that
 * says "denied".
 */

const limitMock = vi.fn();
const slidingWindowMock = vi.fn(() => "sliding-window");
const redisCtor = vi.fn();

vi.mock("@upstash/redis", () => ({
  Redis: class {
    constructor(config: unknown) {
      redisCtor(config);
    }
  },
}));

vi.mock("@upstash/ratelimit", () => {
  class Ratelimit {
    static slidingWindow = slidingWindowMock;
    limit = limitMock;
  }
  return { Ratelimit };
});

const readUpstashCredentials = vi.fn<() => { url: string; token: string } | null>(() => null);
vi.mock("@repo/config/upstash", () => ({
  readUpstashCredentials: () => readUpstashCredentials(),
}));

const {
  ROUTE_LIMITS,
  checkRateLimit,
  clientIpFromHeaders,
  rateLimitHeaders,
  resetRateLimiterForTests,
  retryAfterSeconds,
  verdictFromResult,
} = await import("./rate-limit");
const { apiRoute } = await import("./respond");

const CREDENTIALS = { url: "https://example.upstash.io", token: "tok" };

function headersWithIp(ip: string): Headers {
  return new Headers({ "x-forwarded-for": ip });
}

beforeEach(() => {
  resetRateLimiterForTests();
  limitMock.mockReset();
  readUpstashCredentials.mockReset();
  readUpstashCredentials.mockReturnValue(null);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("clientIpFromHeaders", () => {
  it("prefers platform-set headers over the client-influenced x-forwarded-for", () => {
    const headers = new Headers({
      "x-forwarded-for": "1.1.1.1",
      "x-real-ip": "2.2.2.2",
      "x-vercel-forwarded-for": "3.3.3.3",
    });
    expect(clientIpFromHeaders(headers)).toBe("3.3.3.3");
  });

  it("takes the first entry of an x-forwarded-for chain", () => {
    expect(clientIpFromHeaders(headersWithIp("9.9.9.9, 10.0.0.1, 10.0.0.2"))).toBe("9.9.9.9");
  });

  it("returns null when the header is missing", () => {
    expect(clientIpFromHeaders(new Headers())).toBeNull();
  });

  it("returns null when the header is present but empty or blank", () => {
    expect(clientIpFromHeaders(headersWithIp(""))).toBeNull();
    expect(clientIpFromHeaders(headersWithIp("   "))).toBeNull();
    expect(clientIpFromHeaders(headersWithIp(" , 10.0.0.1"))).toBeNull();
  });

  it("rejects an oversized value instead of truncating it", () => {
    // Truncation would collapse distinct clients onto one shared key.
    expect(clientIpFromHeaders(headersWithIp("a".repeat(200)))).toBeNull();
  });
});

describe("verdictFromResult", () => {
  it("allows a successful check", () => {
    const verdict = verdictFromResult({ success: true, limit: 20, remaining: 19, reset: 1000 }, 0);
    expect(verdict.allowed).toBe(true);
  });

  it("denies and reports the remaining window on failure", () => {
    const verdict = verdictFromResult({ success: false, limit: 20, remaining: 0, reset: 60_000 }, 15_000);
    expect(verdict).toEqual({
      allowed: false,
      limit: 20,
      remaining: 0,
      resetAt: 60_000,
      retryAfterMs: 45_000,
    });
  });

  it("never reports a negative retry window for an already-elapsed reset", () => {
    const verdict = verdictFromResult({ success: false, limit: 20, remaining: 0, reset: 100 }, 5_000);
    expect(verdict.allowed).toBe(false);
    if (!verdict.allowed) expect(verdict.retryAfterMs).toBe(0);
  });
});

describe("retryAfterSeconds", () => {
  it("rounds up to whole seconds", () => {
    expect(retryAfterSeconds(1200)).toBe(2);
  });

  it("is never 0 — a Retry-After of 0 invites an immediately-blocked retry", () => {
    expect(retryAfterSeconds(0)).toBe(1);
  });
});

describe("rateLimitHeaders", () => {
  it("emits Retry-After, the X-RateLimit family and no-store", () => {
    const headers = rateLimitHeaders({
      allowed: false,
      limit: 20,
      remaining: 0,
      resetAt: 1_700_000_500_000,
      retryAfterMs: 30_000,
    });
    expect(headers).toEqual({
      "Retry-After": "30",
      "X-RateLimit-Limit": "20",
      "X-RateLimit-Remaining": "0",
      "X-RateLimit-Reset": "1700000500",
      // A shared cache holding a per-client 429 would turn one client's block
      // into everyone's outage.
      "Cache-Control": "no-store",
    });
  });
});

describe("checkRateLimit — disabled (no credentials)", () => {
  it("allows every request and warns exactly once per process", async () => {
    for (let i = 0; i < 30; i += 1) {
      const verdict = await checkRateLimit("search", headersWithIp("1.2.3.4"));
      expect(verdict.allowed).toBe(true);
    }
    expect(limitMock).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(vi.mocked(console.warn).mock.calls[0]?.[0]).toContain("rate limiting is DISABLED");
  });
});

describe("checkRateLimit — enabled", () => {
  beforeEach(() => {
    readUpstashCredentials.mockReturnValue(CREDENTIALS);
  });

  it("allows while under the limit and denies the request past it", async () => {
    const config = ROUTE_LIMITS.search;
    const reset = Date.now() + 60_000;
    limitMock.mockImplementation(() => {
      const call = limitMock.mock.calls.length;
      return Promise.resolve({
        success: call <= config.limit,
        limit: config.limit,
        remaining: Math.max(0, config.limit - call),
        reset,
      });
    });

    for (let i = 0; i < config.limit; i += 1) {
      const verdict = await checkRateLimit("search", headersWithIp("5.5.5.5"));
      expect(verdict.allowed).toBe(true);
    }
    // N+1 in the same window.
    const denied = await checkRateLimit("search", headersWithIp("5.5.5.5"));
    expect(denied.allowed).toBe(false);
    if (!denied.allowed) expect(denied.limit).toBe(config.limit);
  });

  it("keys on the client IP, not on the route", async () => {
    limitMock.mockResolvedValue({ success: true, limit: 20, remaining: 19, reset: Date.now() + 1000 });
    await checkRateLimit("search", headersWithIp("7.7.7.7"));
    expect(limitMock).toHaveBeenCalledWith("7.7.7.7");
  });

  it("does not limit when no client IP can be derived", async () => {
    // A shared "unknown" bucket would let one unattributable stream lock out
    // every other unattributable client.
    const verdict = await checkRateLimit("search", new Headers());
    expect(verdict.allowed).toBe(true);
    expect(limitMock).not.toHaveBeenCalled();
  });

  it("fails OPEN when Redis throws", async () => {
    limitMock.mockRejectedValue(new Error("ECONNREFUSED"));
    const verdict = await checkRateLimit("tafsir", headersWithIp("8.8.8.8"));
    expect(verdict.allowed).toBe(true);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("fail-open"), expect.anything());
  });

  it("fails OPEN when credentials are present but Redis keeps failing, without log spam", async () => {
    limitMock.mockRejectedValue(new Error("timeout"));
    for (let i = 0; i < 10; i += 1) {
      expect((await checkRateLimit("catalog", headersWithIp("8.8.4.4"))).allowed).toBe(true);
    }
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it("configures one limiter per route class over a single Redis client", async () => {
    limitMock.mockResolvedValue({ success: true, limit: 1, remaining: 1, reset: Date.now() });
    await checkRateLimit("search", headersWithIp("1.1.1.1"));
    expect(redisCtor).toHaveBeenCalledWith(CREDENTIALS);
    expect(slidingWindowMock).toHaveBeenCalledTimes(Object.keys(ROUTE_LIMITS).length);
  });
});

describe("apiRoute — 429 response", () => {
  beforeEach(() => {
    readUpstashCredentials.mockReturnValue(CREDENTIALS);
  });

  it("returns the AppError RATE_LIMITED body shape with the standard headers", async () => {
    const reset = Date.now() + 42_000;
    limitMock.mockResolvedValue({ success: false, limit: 20, remaining: 0, reset });
    const handler = vi.fn();
    const route = apiRoute("search", async () => {
      handler();
      return new Response("unreachable");
    });

    const res = await route(new Request("https://nour.test/api/v1/search?q=x", { headers: headersWithIp("6.6.6.6") }));

    expect(res.status).toBe(429);
    expect(handler).not.toHaveBeenCalled();
    expect(await res.json()).toEqual({ error: "RATE_LIMITED", message: expect.stringContaining("Too many requests") });
    expect(res.headers.get("Retry-After")).toBe(String(Math.ceil((reset - Date.now()) / 1000)));
    expect(res.headers.get("X-RateLimit-Limit")).toBe("20");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    // CORS still applies to the rejection, or mobile/extension clients see an
    // opaque network error instead of a readable 429.
    expect(res.headers.get("Access-Control-Allow-Origin")).not.toBeNull();
  });

  it("runs the handler untouched when the limiter allows", async () => {
    limitMock.mockResolvedValue({ success: true, limit: 20, remaining: 19, reset: Date.now() + 1000 });
    const route = apiRoute("search", async () => new Response("ok", { status: 200 }));
    const res = await route(new Request("https://nour.test/api/v1/search", { headers: headersWithIp("6.6.6.7") }));
    expect(res.status).toBe(200);
    // No rate-limit headers alongside a cacheable success — see rateLimitHeaders.
    expect(res.headers.get("X-RateLimit-Limit")).toBeNull();
  });

  it("serves N requests in a window and rejects the N+1th with a 429", async () => {
    // End-to-end through the wrapper, with the Redis call replaced by an
    // equivalent in-test counter — the sliding-window arithmetic itself is
    // Upstash's Lua script and is not ours to re-test.
    const { limit, windowSeconds } = ROUTE_LIMITS.search;
    const windowEnd = Date.now() + windowSeconds * 1000;
    let used = 0;
    limitMock.mockImplementation(() => {
      used += 1;
      return Promise.resolve({
        success: used <= limit,
        limit,
        remaining: Math.max(0, limit - used),
        reset: windowEnd,
      });
    });

    const served: number[] = [];
    const route = apiRoute("search", async () => {
      served.push(1);
      return new Response(JSON.stringify([]), { status: 200 });
    });
    const call = (): Promise<Response> =>
      route(new Request("https://nour.test/api/v1/search?q=x", { headers: headersWithIp("4.4.4.4") }));

    for (let i = 0; i < limit; i += 1) {
      expect((await call()).status).toBe(200);
    }
    expect(served).toHaveLength(limit);

    const rejected = await call();
    expect(rejected.status).toBe(429);
    // The handler never ran for the rejected request — no Atlas query was made.
    expect(served).toHaveLength(limit);
    expect(await rejected.json()).toEqual({
      error: "RATE_LIMITED",
      message: expect.stringContaining("Too many requests"),
    });
    expect(Number(rejected.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(rejected.headers.get("X-RateLimit-Limit")).toBe(String(limit));
    expect(rejected.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(rejected.headers.get("X-RateLimit-Reset")).toBe(String(Math.ceil(windowEnd / 1000)));
    expect(rejected.headers.get("Cache-Control")).toBe("no-store");
  });

  it("serves the handler when the limiter is disabled", async () => {
    readUpstashCredentials.mockReturnValue(null);
    const route = apiRoute("search", async () => new Response("ok", { status: 200 }));
    const res = await route(new Request("https://nour.test/api/v1/search", { headers: headersWithIp("6.6.6.8") }));
    expect(res.status).toBe(200);
  });
});
