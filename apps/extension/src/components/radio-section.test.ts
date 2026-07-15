import { describe, expect, it, vi } from "vitest";

// radio-section.tsx pulls in content.ts (-> ./api, ./storage) and i18n.ts
// (-> ./storage) at module load; stub them so importing the pure
// `visibleStations` helper doesn't drag in browser/network globals (package
// has no jsdom — see vitest.config.ts `environment: "node"`).
vi.mock("../lib/api", () => ({ getJson: vi.fn(), assetUrl: (p: string) => p }));
vi.mock("../lib/storage", () => ({ get: vi.fn(), set: vi.fn(), watch: vi.fn() }));

import { visibleStations } from "./radio-section";
import type { RadioStationSummary } from "../lib/content";

function makeStations(count: number): RadioStationSummary[] {
  return Array.from({ length: count }, (_, i) => ({
    slug: `station-${i}`,
    title: `Station ${i}`,
    description: null,
    city: null,
    streamUrl: `https://stream.example.com/${i}`,
    image: null,
    isFeatured: false,
  }));
}

describe("visibleStations", () => {
  it("collapses to the first 6 stations when not expanded", () => {
    const result = visibleStations(makeStations(13), false);
    expect(result).toHaveLength(6);
    expect(result.map((s) => s.slug)).toEqual([
      "station-0",
      "station-1",
      "station-2",
      "station-3",
      "station-4",
      "station-5",
    ]);
  });

  it("returns every station when expanded", () => {
    expect(visibleStations(makeStations(13), true)).toHaveLength(13);
  });

  it("returns all stations unmodified when there are 6 or fewer, expanded or not", () => {
    expect(visibleStations(makeStations(6), false)).toHaveLength(6);
    expect(visibleStations(makeStations(3), false)).toHaveLength(3);
  });
});
