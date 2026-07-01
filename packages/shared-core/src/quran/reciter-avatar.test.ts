import { describe, expect, it } from "vitest";

import {
  RECITER_GRADIENTS,
  reciterGradient,
  reciterGradientIndex,
  reciterInitials,
} from "./reciter-avatar";

describe("reciterGradientIndex", () => {
  it("returns an in-range index for text slugs (the NaN-slice bug regression)", () => {
    for (const slug of ["alafasy", "qatami", "sudais", "minshawi"]) {
      const idx = reciterGradientIndex(slug);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(RECITER_GRADIENTS.length);
      expect(Number.isNaN(idx)).toBe(false);
    }
  });

  it("is deterministic for the same slug", () => {
    expect(reciterGradientIndex("alafasy")).toBe(reciterGradientIndex("alafasy"));
  });

  it("distributes distinct slugs across the palette (not all gradient[0])", () => {
    const indices = new Set(
      ["alafasy", "qatami", "sudais", "minshawi", "husary"].map(reciterGradientIndex),
    );
    expect(indices.size).toBeGreaterThan(1);
  });

  it("reciterGradient returns a [from, to] pair", () => {
    const g = reciterGradient("alafasy");
    expect(g).toHaveLength(2);
    expect(g[0]).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe("reciterInitials", () => {
  it("takes first + last word initials for multi-word names", () => {
    expect(reciterInitials("Mishary Rashid Alafasy")).toBe("MA");
    expect(reciterInitials("Nasser Al Qatami")).toBe("NQ");
  });

  it("returns a single initial for one-word names", () => {
    expect(reciterInitials("Sudais")).toBe("S");
  });

  it("handles Arabic names (no case change)", () => {
    expect(reciterInitials("مشاري راشد العفاسي")).toBe("ما");
  });

  it("collapses extra whitespace and falls back to '?' on empty input", () => {
    expect(reciterInitials("  Saad   Al   Ghamdi ")).toBe("SG");
    expect(reciterInitials("   ")).toBe("?");
  });
});
