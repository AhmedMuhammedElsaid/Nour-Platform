import { describe, expect, it, vi } from "vitest";

// radio-section.tsx pulls in content.ts (-> ./api, ./storage), i18n.ts, and
// radio-store.ts (-> ./storage) at module load; stub them so importing the
// pure `previewStations` helper doesn't drag in browser/network globals
// (package has no jsdom — see vitest.config.ts `environment: "node"`).
vi.mock("../lib/api", () => ({ getJson: vi.fn(), assetUrl: (p: string) => p }));
vi.mock("../lib/storage", () => ({ get: vi.fn(), set: vi.fn(), watch: vi.fn() }));

import { previewStations } from "./radio-section";
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

describe("previewStations", () => {
  it("takes only the first 4 stations by default", () => {
    const result = previewStations(makeStations(13));
    expect(result).toHaveLength(4);
    expect(result.map((s) => s.slug)).toEqual([
      "station-0",
      "station-1",
      "station-2",
      "station-3",
    ]);
  });

  it("returns all stations unmodified when there are fewer than the limit", () => {
    expect(previewStations(makeStations(3))).toHaveLength(3);
    expect(previewStations(makeStations(0))).toHaveLength(0);
  });

  it("honours a custom limit", () => {
    expect(previewStations(makeStations(10), 2)).toHaveLength(2);
  });
});
