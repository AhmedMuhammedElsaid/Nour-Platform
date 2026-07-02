import { describe, expect, it, vi } from "vitest";

// content.ts imports ./api + ./storage at module load; stub them so importing
// the pure buildStationQueue helper doesn't drag in browser/network globals.
vi.mock("./api", () => ({ getJson: vi.fn(), assetUrl: (p: string) => p }));
vi.mock("./storage", () => ({ get: vi.fn(), set: vi.fn() }));

import { buildStationQueue, type RadioStationSummary } from "./content";

const station: RadioStationSummary = {
  slug: "quran-cairo",
  title: "إذاعة القرآن الكريم",
  description: null,
  city: "Cairo",
  streamUrl: "https://stream.radiojar.com/8s5u5tpdtwzuv",
  image: null,
  isFeatured: true,
};

describe("buildStationQueue", () => {
  it("produces a single live item with a radio: id and the stream url", () => {
    const queue = buildStationQueue(station);
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({
      id: "radio:quran-cairo",
      url: "https://stream.radiojar.com/8s5u5tpdtwzuv",
      title: "إذاعة القرآن الكريم",
      slug: "quran-cairo",
      isLive: true,
    });
    // Live streams carry no duration (infinite), so the field is absent.
    expect(queue[0]!.durationSecs).toBeUndefined();
  });

  it("puts the city in the artist line and omits artwork when there is no image", () => {
    const queue = buildStationQueue(station);
    expect(queue[0]!.artist).toContain("Cairo");
    expect(queue[0]!.artwork).toBeUndefined();
  });

  it("carries artwork through when the station has an image", () => {
    const queue = buildStationQueue({ ...station, image: "https://cdn/x.png" });
    expect(queue[0]!.artwork).toBe("https://cdn/x.png");
  });
});
