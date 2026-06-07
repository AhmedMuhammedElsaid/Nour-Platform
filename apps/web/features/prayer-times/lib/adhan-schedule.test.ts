import { describe, expect, it } from "vitest";

import { DEFAULT_ADHAN_SETTINGS } from "@repo/api/schemas/prayer-times";
import type { PrayerInstant } from "@repo/api/services/prayer-times";

import { nextAdhanEvent } from "./adhan-schedule";

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
