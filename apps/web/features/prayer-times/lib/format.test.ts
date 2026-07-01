import { describe, expect, it } from "vitest";

import {
  formatClock,
  formatCountdown,
  formatCountdownClock,
  hijriDate,
} from "./format";

describe("formatCountdown", () => {
  it("breaks milliseconds into whole hours and minutes", () => {
    expect(formatCountdown(2 * 3600_000 + 14 * 60_000)).toEqual({ h: 2, m: 14 });
  });
  it("never goes negative", () => {
    expect(formatCountdown(-5000)).toEqual({ h: 0, m: 0 });
  });
});

describe("formatCountdownClock", () => {
  it("renders H:MM:SS with an unpadded hours segment when an hour or more remains", () => {
    expect(formatCountdownClock(2 * 3600_000 + 15 * 60_000 + 43_000)).toBe("2:15:43");
  });
  it("keeps two-digit hours intact (no change for 11/12h)", () => {
    expect(formatCountdownClock(11 * 3600_000 + 2 * 60_000 + 9_000)).toBe("11:02:09");
  });
  it("drops the hours segment under an hour (MM:SS)", () => {
    expect(formatCountdownClock(4 * 60_000 + 37_000)).toBe("04:37");
  });
  it("clamps a negative duration to 00:00", () => {
    expect(formatCountdownClock(-5000)).toBe("00:00");
  });
  it("localizes digits to Arabic-Indic in ar", () => {
    expect(formatCountdownClock(4 * 60_000 + 37_000, "ar")).toBe("٠٤:٣٧");
  });
  it("unpads the Arabic-Indic hours segment (٤:٢٨:٢٠, not ٠٤:٢٨:٢٠)", () => {
    expect(formatCountdownClock(4 * 3600_000 + 28 * 60_000 + 20_000, "ar")).toBe(
      "٤:٢٨:٢٠",
    );
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
