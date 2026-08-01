import { beforeEach, describe, expect, it, vi } from "vitest";

// Recording next/cache mock — see playlist.service.test.ts for why a
// call-through-only mock would be vacuous here. `simulateHit` reproduces Next's
// real JSON.stringify/JSON.parse storage round-trip.
const cacheMock = vi.hoisted(() => {
  const calls: Array<{
    keyParts: readonly string[];
    tags: readonly string[];
    revalidate: unknown;
  }> = [];
  const state = { simulateHit: false };
  return {
    calls,
    state,
    unstable_cache: (
      cb: () => Promise<unknown>,
      keyParts: readonly string[],
      opts: { tags: readonly string[]; revalidate: unknown },
    ) => {
      calls.push({ keyParts, tags: opts.tags, revalidate: opts.revalidate });
      if (!state.simulateHit) return cb;
      return async () => JSON.parse(JSON.stringify(await cb())) as unknown;
    },
  };
});

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  unstable_cache: cacheMock.unstable_cache,
}));

vi.mock("../repositories/radio.repo", () => ({
  findAllStations: vi.fn(),
  findFeaturedStations: vi.fn(),
  findStationBySlug: vi.fn(),
  findStationById: vi.fn(),
}));

const repo = await import("../repositories/radio.repo");
const service = await import("./radio.service");

function stationDoc(over: Record<string, unknown> = {}): any {
  return {
    _id: { toString: () => "st1" },
    slug: "quran-cairo",
    ar: { name: "إذاعة القرآن الكريم", description: "بث مباشر" },
    en: { name: "Holy Quran Radio", description: "Live" },
    country: "EG",
    city: "Cairo",
    image: "/radio/cairo.png",
    streamUrl: "https://example.com/stream.mp3",
    streamType: "mp3",
    bitrate: 128,
    language: "ar",
    category: "quran",
    nowPlayingUrl: "https://example.com/now.json",
    isLive: true,
    isFeatured: true,
    order: 0,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  cacheMock.calls.length = 0;
  cacheMock.state.simulateHit = false;
});

describe("radio.service", () => {
  it("listStations maps lean docs to DTOs", async () => {
    vi.mocked(repo.findAllStations).mockResolvedValueOnce([stationDoc()]);
    const result = await service.listStations();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "st1",
      slug: "quran-cairo",
      ar: { name: "إذاعة القرآن الكريم" },
      streamUrl: "https://example.com/stream.mp3",
      streamType: "mp3",
      isLive: true,
      isFeatured: true,
    });
  });

  it("getFeaturedStations delegates to the featured repo read", async () => {
    vi.mocked(repo.findFeaturedStations).mockResolvedValueOnce([stationDoc()]);
    const result = await service.getFeaturedStations();
    expect(result).toHaveLength(1);
    expect(result[0]!.isFeatured).toBe(true);
    expect(vi.mocked(repo.findFeaturedStations)).toHaveBeenCalledOnce();
  });

  it("getStationBySlug returns the DTO when found and live", async () => {
    vi.mocked(repo.findStationBySlug).mockResolvedValueOnce(stationDoc());
    const result = await service.getStationBySlug("quran-cairo");
    expect(result.slug).toBe("quran-cairo");
    expect(result.ar.name).toBe("إذاعة القرآن الكريم");
  });

  it("getStationBySlug throws NotFound when missing", async () => {
    vi.mocked(repo.findStationBySlug).mockResolvedValueOnce(null);
    await expect(service.getStationBySlug("nope")).rejects.toThrow();
  });

  it("getStationBySlug hides a disabled (isLive:false) station", async () => {
    vi.mocked(repo.findStationBySlug).mockResolvedValueOnce(stationDoc({ isLive: false }));
    await expect(service.getStationBySlug("quran-cairo")).rejects.toThrow();
  });

  it("wraps each read under the RADIO tag with a distinct key", async () => {
    vi.mocked(repo.findAllStations).mockResolvedValueOnce([]);
    vi.mocked(repo.findFeaturedStations).mockResolvedValueOnce([]);
    vi.mocked(repo.findStationBySlug).mockResolvedValueOnce(stationDoc());

    await service.listStations();
    await service.getFeaturedStations();
    await service.getStationBySlug("quran-cairo");

    expect(cacheMock.calls.map((c) => c.keyParts)).toEqual([
      ["radio", "stations"],
      ["radio", "featured"],
      ["radio", "by-slug", "quran-cairo"],
    ]);
    expect(cacheMock.calls.every((c) => c.tags[0] === "radio")).toBe(true);
  });

  it("gives two different slugs two different keys", async () => {
    vi.mocked(repo.findStationBySlug).mockResolvedValue(stationDoc());

    await service.getStationBySlug("quran-cairo");
    await service.getStationBySlug("quran-makkah");

    expect(cacheMock.calls[0]!.keyParts).not.toEqual(cacheMock.calls[1]!.keyParts);
  });

  it("still hides a disabled station when the entry comes back from cache", async () => {
    // The isLive gate lives outside the cache, so it must still fire on a hit.
    cacheMock.state.simulateHit = true;
    vi.mocked(repo.findStationBySlug).mockResolvedValueOnce(stationDoc({ isLive: false }));

    await expect(service.getStationBySlug("quran-cairo")).rejects.toThrow();
  });

  it("still returns real Dates on a cache HIT (JSON round-trip)", async () => {
    cacheMock.state.simulateHit = true;
    vi.mocked(repo.findAllStations).mockResolvedValueOnce([stationDoc()]);

    const [dto] = await service.listStations();

    expect(dto!.createdAt).toBeInstanceOf(Date);
    expect(dto!.updatedAt).toBeInstanceOf(Date);
  });

  it("omits optional fields that are absent on the doc", async () => {
    vi.mocked(repo.findAllStations).mockResolvedValueOnce([
      stationDoc({
        city: undefined,
        image: undefined,
        bitrate: undefined,
        nowPlayingUrl: undefined,
        ar: { name: "x" },
        en: { name: "y" },
      }),
    ]);
    const [dto] = await service.listStations();
    expect(dto).not.toHaveProperty("city");
    expect(dto).not.toHaveProperty("image");
    expect(dto).not.toHaveProperty("bitrate");
    expect(dto).not.toHaveProperty("nowPlayingUrl");
    expect(dto!.ar).not.toHaveProperty("description");
  });
});
