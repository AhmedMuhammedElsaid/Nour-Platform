import { describe, expect, it } from "vitest";

import {
  nextPartCursor,
  prevPartCursor,
  resolveEntryPart,
  settlePart,
} from "./page-parts";

// Page 293 is the owner's reported case: segment 0 = Al-Israa (17) ending,
// segment 1 = Al-Kahf (18) opening.
const P293 = [17, 18];

describe("resolveEntryPart", () => {
  it("opens on the entered surah, not the page's first segment", () => {
    expect(resolveEntryPart(P293, 18)).toBe(1);
  });

  it("opens on segment 0 when the entered surah owns the page's first ayah", () => {
    expect(resolveEntryPart(P293, 17)).toBe(0);
  });

  it("falls back to 0 when the surah isn't on the page", () => {
    expect(resolveEntryPart(P293, 2)).toBe(0);
  });

  it("handles a single-surah page", () => {
    expect(resolveEntryPart([2], 2)).toBe(0);
  });
});

describe("nextPartCursor", () => {
  it("advances within the page while parts remain", () => {
    expect(nextPartCursor({ page: 293, part: 0 }, 2, 294)).toEqual({ page: 293, part: 1 });
  });

  it("crosses to the next page's FIRST part once the page is exhausted", () => {
    expect(nextPartCursor({ page: 293, part: 1 }, 2, 294)).toEqual({ page: 294, part: "first" });
  });

  it("behaves exactly like page-paging on a single-segment page", () => {
    expect(nextPartCursor({ page: 292, part: 0 }, 1, 293)).toEqual({ page: 293, part: "first" });
  });

  it("returns null at the end of the mushaf", () => {
    expect(nextPartCursor({ page: 604, part: 2 }, 3, null)).toBeNull();
  });
});

describe("prevPartCursor", () => {
  it("steps back within the page", () => {
    expect(prevPartCursor({ page: 293, part: 1 }, 292)).toEqual({ page: 293, part: 0 });
  });

  it("crosses to the previous page's LAST part, so its later surahs aren't skipped", () => {
    expect(prevPartCursor({ page: 293, part: 0 }, 292)).toEqual({ page: 292, part: "last" });
  });

  it("returns null at the start of the mushaf", () => {
    expect(prevPartCursor({ page: 1, part: 0 }, null)).toBeNull();
  });
});

describe("settlePart", () => {
  it("resolves the pending sentinels against the arrived segment count", () => {
    expect(settlePart("first", 3)).toBe(0);
    expect(settlePart("last", 3)).toBe(2);
  });

  it("passes a concrete part through", () => {
    expect(settlePart(1, 3)).toBe(1);
  });

  it("clamps a part left over from a longer page", () => {
    expect(settlePart(2, 1)).toBe(0);
    expect(settlePart(-1, 3)).toBe(0);
  });

  it("never returns a negative index for an empty page", () => {
    expect(settlePart("last", 0)).toBe(0);
  });
});

describe("round trip", () => {
  it("next-then-prev returns to the same flip across a page boundary", () => {
    const start = { page: 293, part: 1 };
    const forward = nextPartCursor(start, 2, 294);
    expect(forward).toEqual({ page: 294, part: "first" });

    // Page 294 turns out to hold a single surah.
    const landed = { page: 294, part: settlePart(forward!.part, 1) };
    const back = prevPartCursor(landed, 293);
    expect(back).toEqual({ page: 293, part: "last" });
    expect(settlePart(back!.part, 2)).toBe(1);
  });
});
