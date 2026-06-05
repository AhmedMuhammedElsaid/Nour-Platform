import { describe, expect, it } from "vitest";

import { formatClock, formatCountdown, hijriDate } from "./format";

describe("formatCountdown", () => {
  it("breaks milliseconds into whole hours and minutes", () => {
    expect(formatCountdown(2 * 3600_000 + 14 * 60_000)).toEqual({ h: 2, m: 14 });
  });
  it("never goes negative", () => {
    expect(formatCountdown(-5000)).toEqual({ h: 0, m: 0 });
  });
});

describe("formatClock", () => {
  it("formats a Date to a localized HH:MM string", () => {
    const out = formatClock(new Date("2026-06-05T15:42:00Z"), "en", "UTC");
    expect(out).toMatch(/3:42|15:42/); // 12h or 24h depending on ICU
  });
  it("returns an em dash for a null time", () => {
    expect(formatClock(null, "en", "UTC")).toBe("—");
  });
});

describe("hijriDate", () => {
  it("returns a non-empty Islamic-calendar string", () => {
    expect(hijriDate(new Date("2026-06-05T12:00:00Z"), "en").length).toBeGreaterThan(0);
  });
});
