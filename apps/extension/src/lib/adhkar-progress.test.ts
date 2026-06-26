import { describe, expect, it } from "vitest";

import { completedCount, getCount } from "./adhkar-progress";
import type { AzkarProgress } from "./storage";

const progress: AzkarProgress = {
  date: "2026-06-27",
  sets: {
    morning: { "0": 3, "1": 1, "2": 0 },
  },
};

describe("getCount", () => {
  it("reads a recorded count, defaulting to 0", () => {
    expect(getCount(progress, "morning", 0)).toBe(3);
    expect(getCount(progress, "morning", 2)).toBe(0);
    expect(getCount(progress, "morning", 9)).toBe(0); // unrecorded index
    expect(getCount(progress, "evening", 0)).toBe(0); // unrecorded set
  });
});

describe("completedCount", () => {
  it("counts items whose count has reached its repeat target", () => {
    // item0 needs 3 (has 3 ✓), item1 needs 3 (has 1 ✗), item2 needs 1 (has 0 ✗)
    expect(completedCount(progress, "morning", [3, 3, 1])).toBe(1);
    // item0 needs 1 (✓), item1 needs 1 (✓), item2 needs 1 (✗)
    expect(completedCount(progress, "morning", [1, 1, 1])).toBe(2);
  });

  it("returns 0 for an untouched set", () => {
    expect(completedCount(progress, "evening", [1, 1])).toBe(0);
  });

  it("treats over-count as complete", () => {
    expect(completedCount(progress, "morning", [1])).toBe(1);
  });
});
