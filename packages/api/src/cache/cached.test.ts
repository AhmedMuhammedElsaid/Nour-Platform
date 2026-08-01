import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Guards the two contracts the service wrappers depend on:
 *  1. cachedRead forwards keyParts/tags/revalidate verbatim to unstable_cache.
 *  2. reviveDates normalises a JSON round-tripped DTO back to real Dates —
 *     the difference between a cache MISS (Date) and a cache HIT (ISO string).
 */
const cacheMock = vi.hoisted(() => {
  const calls: Array<{
    keyParts: readonly string[];
    tags: readonly string[];
    revalidate: unknown;
  }> = [];
  return {
    calls,
    unstable_cache: (
      cb: () => Promise<unknown>,
      keyParts: readonly string[],
      opts: { tags: readonly string[]; revalidate: unknown },
    ) => {
      calls.push({ keyParts, tags: opts.tags, revalidate: opts.revalidate });
      return cb;
    },
  };
});

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  unstable_cache: cacheMock.unstable_cache,
}));

const {
  cachedRead,
  reviveDates,
  CONTENT_TTL_SECONDS,
  IMMUTABLE_TTL_SECONDS,
} = await import("./cached");

beforeEach(() => {
  cacheMock.calls.length = 0;
});

describe("cachedRead", () => {
  it("forwards keyParts, tags and revalidate to unstable_cache and returns the value", async () => {
    const result = await cachedRead(["a", "b"], ["tag-x"], 42, async () => "value");

    expect(result).toBe("value");
    expect(cacheMock.calls).toEqual([
      { keyParts: ["a", "b"], tags: ["tag-x"], revalidate: 42 },
    ]);
  });

  it("does not swallow a rejection (error paths must never be cached silently)", async () => {
    await expect(
      cachedRead(["a"], ["tag-x"], 1, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
  });

  it("exposes a short TTL for editable content and a long one for immutable content", () => {
    expect(CONTENT_TTL_SECONDS).toBe(300);
    expect(IMMUTABLE_TTL_SECONDS).toBe(86_400);
    expect(IMMUTABLE_TTL_SECONDS).toBeGreaterThan(CONTENT_TTL_SECONDS);
  });
});

describe("reviveDates", () => {
  const created = new Date("2024-03-01T10:20:30.000Z");
  const updated = new Date("2024-05-02T01:02:03.000Z");

  it("restores Dates from the ISO strings a cache hit yields", () => {
    const fromCache = JSON.parse(
      JSON.stringify({ id: "x", createdAt: created, updatedAt: updated }),
    ) as { id: string; createdAt: Date; updatedAt: Date };

    // Precondition: the round-trip really did degrade the type.
    expect(typeof (fromCache as unknown as { createdAt: unknown }).createdAt).toBe(
      "string",
    );

    const revived = reviveDates(fromCache);

    expect(revived.createdAt).toBeInstanceOf(Date);
    expect(revived.createdAt.getTime()).toBe(created.getTime());
    expect(revived.updatedAt.getTime()).toBe(updated.getTime());
    expect(revived.id).toBe("x");
  });

  it("is a no-op on the cache-miss path where the values are already Dates", () => {
    const revived = reviveDates({ id: "x", createdAt: created, updatedAt: updated });

    expect(revived.createdAt.getTime()).toBe(created.getTime());
    expect(revived.updatedAt.getTime()).toBe(updated.getTime());
  });
});
