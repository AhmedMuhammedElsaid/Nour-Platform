import { describe, expect, it, vi } from "vitest";

// adhkar-preview-shelf.tsx pulls in content.ts (-> ./api, ./storage) and
// i18n.ts at module load; stub them so importing the pure `previewAdhkarSets`
// helper doesn't drag in browser/network globals (package has no jsdom —
// see vitest.config.ts `environment: "node"`).
vi.mock("../lib/api", () => ({ getJson: vi.fn(), assetUrl: (p: string) => p }));
vi.mock("../lib/storage", () => ({ get: vi.fn(), set: vi.fn(), watch: vi.fn() }));

import { previewAdhkarSets } from "./adhkar-preview-shelf";
import type { AdhkarSummary } from "../lib/content";

function makeSets(count: number): AdhkarSummary[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `set-${i}`,
    kind: "other",
    title: `Set ${i}`,
    slug: `set-${i}`,
    itemCount: 3,
    repeats: [3, 3, 3],
  }));
}

describe("previewAdhkarSets", () => {
  it("takes only the first 5 sets by default", () => {
    const result = previewAdhkarSets(makeSets(6));
    expect(result).toHaveLength(5);
    expect(result.map((s) => s.slug)).toEqual([
      "set-0",
      "set-1",
      "set-2",
      "set-3",
      "set-4",
    ]);
  });

  it("returns all sets unmodified when there are fewer than the limit", () => {
    expect(previewAdhkarSets(makeSets(3))).toHaveLength(3);
    expect(previewAdhkarSets(makeSets(0))).toHaveLength(0);
  });

  it("honours a custom limit", () => {
    expect(previewAdhkarSets(makeSets(10), 2)).toHaveLength(2);
  });
});
