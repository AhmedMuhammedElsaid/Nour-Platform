import { describe, expect, it } from "vitest";

import { DEFAULT_ADHAN_SETTINGS } from "@repo/api/schemas/prayer-times";
import type { PrayerInstant } from "@repo/api/services/prayer-times";

import {
  isAdhanEventStale,
  nextAdhanEvent,
  recentlyMissedAdhan,
} from "./adhan-schedule";

function instants(): PrayerInstant[] {
  const d = (h: number, m = 0) => new Date(2026, 5, 7, h, m, 0, 0);
  return [
    { key: "fajr", time: d(4) },
    { key: "sunrise", time: d(6) },
    { key: "dhuhr", time: d(12) },
    { key: "asr", time: d(15) },
    { key: "maghrib", time: d(19) },
    { key: "isha", time: d(20, 30) },
  ];
}

describe("nextAdhanEvent", () => {
  it("returns the soonest enabled prayer strictly after now", () => {
    const now = new Date(2026, 5, 7, 13, 0, 0);
    const ev = nextAdhanEvent(instants(), DEFAULT_ADHAN_SETTINGS, now);
    expect(ev?.key).toBe("asr");
  });

  it("never returns sunrise", () => {
    const now = new Date(2026, 5, 7, 5, 0, 0);
    const ev = nextAdhanEvent(instants(), DEFAULT_ADHAN_SETTINGS, now);
    expect(ev?.key).toBe("dhuhr");
  });

  it("skips a disabled prayer", () => {
    const now = new Date(2026, 5, 7, 13, 0, 0);
    const settings = {
      ...DEFAULT_ADHAN_SETTINGS,
      perPrayer: { ...DEFAULT_ADHAN_SETTINGS.perPrayer, asr: false },
    };
    const ev = nextAdhanEvent(instants(), settings, now);
    expect(ev?.key).toBe("maghrib");
  });

  it("returns null when no enabled prayer remains today", () => {
    const now = new Date(2026, 5, 7, 21, 0, 0);
    expect(nextAdhanEvent(instants(), DEFAULT_ADHAN_SETTINGS, now)).toBeNull();
  });

  it("returns null when all prayers disabled", () => {
    const now = new Date(2026, 5, 7, 3, 0, 0);
    const settings = {
      ...DEFAULT_ADHAN_SETTINGS,
      perPrayer: { fajr: false, dhuhr: false, asr: false, maghrib: false, isha: false },
    };
    expect(nextAdhanEvent(instants(), settings, now)).toBeNull();
  });
});

describe("recentlyMissedAdhan", () => {
  const GRACE = 2 * 60_000; // 2 min

  it("returns an adhan that passed within the grace window", () => {
    // Dhuhr is 12:00; now is 12:01 → within 2 min.
    const now = new Date(2026, 5, 7, 12, 1, 0);
    const ev = recentlyMissedAdhan(instants(), DEFAULT_ADHAN_SETTINGS, now, GRACE);
    expect(ev?.key).toBe("dhuhr");
  });

  it("returns null when the last adhan is older than the grace window", () => {
    // Dhuhr 12:00; now 12:05 → 5 min ago, outside 2 min grace.
    const now = new Date(2026, 5, 7, 12, 5, 0);
    expect(
      recentlyMissedAdhan(instants(), DEFAULT_ADHAN_SETTINGS, now, GRACE),
    ).toBeNull();
  });

  it("ignores a disabled prayer even if recently passed", () => {
    const now = new Date(2026, 5, 7, 12, 1, 0);
    const settings = {
      ...DEFAULT_ADHAN_SETTINGS,
      perPrayer: { ...DEFAULT_ADHAN_SETTINGS.perPrayer, dhuhr: false },
    };
    expect(recentlyMissedAdhan(instants(), settings, now, GRACE)).toBeNull();
  });

  it("never returns sunrise", () => {
    // Sunrise 06:00; now 06:01 within grace, but sunrise has no adhan.
    const now = new Date(2026, 5, 7, 6, 1, 0);
    expect(
      recentlyMissedAdhan(instants(), DEFAULT_ADHAN_SETTINGS, now, GRACE),
    ).toBeNull();
  });

  it("does not return a future adhan", () => {
    // now 11:59, Dhuhr 12:00 is in the future → not "missed".
    const now = new Date(2026, 5, 7, 11, 59, 0);
    expect(
      recentlyMissedAdhan(instants(), DEFAULT_ADHAN_SETTINGS, now, GRACE),
    ).toBeNull();
  });
});

describe("isAdhanEventStale", () => {
  const GRACE = 2 * 60_000; // 2 min
  const ev = (h: number, m = 0) => ({
    key: "fajr" as const,
    time: new Date(2026, 5, 7, h, m, 0, 0),
  });

  it("is stale when a pre-Fajr timer resolves on wake at Maghrib", () => {
    // The bug: Fajr precise timer (04:00) paused during device sleep resumes at
    // Maghrib (19:00) — ~15h late — and would otherwise play the Fajr adhan.
    const now = new Date(2026, 5, 7, 19, 0, 0);
    expect(isAdhanEventStale(ev(4), now, GRACE)).toBe(true);
  });

  it("is not stale when fired within the grace window", () => {
    const now = new Date(2026, 5, 7, 4, 1, 0); // 1 min after a 04:00 event
    expect(isAdhanEventStale(ev(4), now, GRACE)).toBe(false);
  });

  it("is not stale at exactly the grace boundary", () => {
    const now = new Date(2026, 5, 7, 4, 2, 0); // exactly 2 min after
    expect(isAdhanEventStale(ev(4), now, GRACE)).toBe(false);
  });

  it("is not stale when the timer fires slightly early", () => {
    const now = new Date(2026, 5, 7, 3, 59, 59); // event still 1s in the future
    expect(isAdhanEventStale(ev(4), now, GRACE)).toBe(false);
  });
});
