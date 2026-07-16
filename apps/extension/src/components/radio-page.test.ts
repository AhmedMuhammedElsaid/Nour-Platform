import { describe, expect, it, vi } from "vitest";

// radio-page.tsx pulls in content.ts (-> ./api, ./storage), i18n.ts, and
// radio-store.ts (-> ./storage) at module load; stub them so importing the
// pure helpers doesn't drag in browser/network globals (package has no
// jsdom — see vitest.config.ts `environment: "node"`).
vi.mock("../lib/api", () => ({ getJson: vi.fn(), assetUrl: (p: string) => p }));
vi.mock("../lib/storage", () => ({ get: vi.fn(), set: vi.fn(), watch: vi.fn() }));

import { resolveRecentStations, sortFavoritesFirst } from "./radio-page";
import type { RadioStationSummary } from "../lib/content";

function station(slug: string): RadioStationSummary {
  return {
    slug,
    title: `Station ${slug}`,
    description: null,
    city: null,
    streamUrl: `https://stream.example.com/${slug}`,
    image: null,
    isFeatured: false,
  };
}

const stations = [station("a"), station("b"), station("c")];

describe("sortFavoritesFirst", () => {
  it("floats favorited stations to the top, keeping server order otherwise", () => {
    const result = sortFavoritesFirst(stations, ["c"]);
    expect(result.map((s) => s.slug)).toEqual(["c", "a", "b"]);
  });

  it("returns the original order when there are no favorites", () => {
    expect(sortFavoritesFirst(stations, []).map((s) => s.slug)).toEqual(["a", "b", "c"]);
  });
});

describe("resolveRecentStations", () => {
  it("resolves MRU slugs to stations, capped to the last 3 by default", () => {
    const recent = ["c", "b", "a"]; // MRU order (most recent first)
    const withMore = [...stations, station("d")];
    const result = resolveRecentStations(withMore, [...recent, "d"]);
    expect(result.map((s) => s.slug)).toEqual(["c", "b", "a"]);
  });

  it("drops slugs that no longer resolve to a known station", () => {
    expect(resolveRecentStations(stations, ["ghost", "a"]).map((s) => s.slug)).toEqual(["a"]);
  });

  it("honours a custom limit", () => {
    expect(resolveRecentStations(stations, ["a", "b", "c"], 1).map((s) => s.slug)).toEqual(["a"]);
  });
});
