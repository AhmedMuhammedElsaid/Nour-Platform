import { beforeEach, describe, expect, it, vi } from "vitest";

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

beforeEach(() => vi.clearAllMocks());

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
