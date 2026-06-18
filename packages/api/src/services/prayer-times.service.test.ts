import { describe, expect, it } from "vitest";

import {
  computePrayerTimes,
  getNextPrayer,
  getUpcomingPrayer,
  getDayProgress,
  getArcPosition,
  type PrayerDay,
} from "./prayer-times.service";

// Cairo, fixed civil date. Egyptian method, standard madhab.
const CAIRO = { lat: 30.0444, lng: 31.2357 } as const;
const DATE = new Date("2026-06-05T09:00:00Z");

function cairoDay(): PrayerDay {
  return computePrayerTimes({
    ...CAIRO,
    date: DATE,
    method: "Egyptian",
    madhab: "standard",
  });
}

describe("computePrayerTimes", () => {
  it("returns six ordered instants with valid Dates for a normal location", () => {
    const day = cairoDay();
    expect(day.instants.map((i) => i.key)).toEqual([
      "fajr",
      "sunrise",
      "dhuhr",
      "asr",
      "maghrib",
      "isha",
    ]);
    for (const inst of day.instants) {
      expect(inst.time).toBeInstanceOf(Date);
      expect(Number.isNaN((inst.time as Date).getTime())).toBe(false);
    }
  });

  it("orders the instants chronologically through the day", () => {
    const times = cairoDay().instants.map((i) => (i.time as Date).getTime());
    const sorted = [...times].sort((a, b) => a - b);
    expect(times).toEqual(sorted);
  });

  it("yields null times for a high-latitude location where a prayer may not occur", () => {
    // Longyearbyen, Svalbard in June — polar day; some angles never reached.
    const day = computePrayerTimes({
      lat: 78.22,
      lng: 15.65,
      date: new Date("2026-06-21T12:00:00Z"),
      method: "MuslimWorldLeague",
      madhab: "standard",
    });
    const hasNull = day.instants.some((i) => i.time === null);
    expect(hasNull).toBe(true);
  });
});

describe("getNextPrayer", () => {
  it("returns the first countdown-prayer after `now` (skips sunrise)", () => {
    const day = cairoDay();
    const fajr = day.instants.find((i) => i.key === "fajr")!.time as Date;
    // One minute after Fajr → next countdown prayer is Dhuhr (sunrise skipped).
    const now = new Date(fajr.getTime() + 60_000);
    const next = getNextPrayer(day, now);
    expect(next?.key).toBe("dhuhr");
    expect(next!.msUntil).toBeGreaterThan(0);
  });

  it("returns null after Isha", () => {
    const day = cairoDay();
    const isha = day.instants.find((i) => i.key === "isha")!.time as Date;
    const now = new Date(isha.getTime() + 60_000);
    expect(getNextPrayer(day, now)).toBeNull();
  });
});

describe("getUpcomingPrayer", () => {
  it("rolls over to tomorrow's Fajr after Isha", () => {
    const today = cairoDay();
    const isha = today.instants.find((i) => i.key === "isha")!.time as Date;
    const now = new Date(isha.getTime() + 60_000);
    const up = getUpcomingPrayer(
      { ...CAIRO, method: "Egyptian", madhab: "standard" },
      now,
    );
    expect(up.key).toBe("fajr");
    expect(up.time.getTime()).toBeGreaterThan(now.getTime());
  });
});

describe("getDayProgress", () => {
  it("is 0 at Fajr, 1 at Isha, ~0.5 midway", () => {
    const day = cairoDay();
    const fajr = day.instants.find((i) => i.key === "fajr")!.time as Date;
    const isha = day.instants.find((i) => i.key === "isha")!.time as Date;
    expect(getDayProgress(day, fajr)).toBeCloseTo(0, 2);
    expect(getDayProgress(day, isha)).toBeCloseTo(1, 2);
    const mid = new Date((fajr.getTime() + isha.getTime()) / 2);
    expect(getDayProgress(day, mid)).toBeCloseTo(0.5, 2);
  });

  it("clamps to [0,1] outside the Fajr–Isha window", () => {
    const day = cairoDay();
    const fajr = day.instants.find((i) => i.key === "fajr")!.time as Date;
    expect(getDayProgress(day, new Date(fajr.getTime() - 3_600_000))).toBe(0);
  });
});

describe("getArcPosition", () => {
  const PARAMS = { ...CAIRO, method: "Egyptian", madhab: "standard" } as const;

  it("is the sun (not night) during the day — Sunrise → Maghrib", () => {
    const day = cairoDay();
    const sunrise = day.instants.find((i) => i.key === "sunrise")!.time as Date;
    const maghrib = day.instants.find((i) => i.key === "maghrib")!.time as Date;

    // Just after Sunrise — sun visible, sitting at the Sunrise dot (fraction ~0,
    // since the day track now spans Sunrise(0)→Maghrib(1)).
    const dawn = getArcPosition(PARAMS, new Date(sunrise.getTime() + 60_000));
    expect(dawn.isNight).toBe(false);
    expect(dawn.fraction).toBeGreaterThanOrEqual(0);
    expect(dawn.fraction).toBeLessThan(0.2);

    // Just before Maghrib — sun visible, near the Maghrib dot.
    const dusk = getArcPosition(PARAMS, new Date(maghrib.getTime() - 60_000));
    expect(dusk.isNight).toBe(false);
    expect(dusk.fraction).toBeGreaterThan(0.8);
    expect(dusk.fraction).toBeLessThanOrEqual(1);
  });

  it("shows the moon just after Maghrib, near the right (fraction ~1)", () => {
    const day = cairoDay();
    const maghrib = day.instants.find((i) => i.key === "maghrib")!.time as Date;
    const info = getArcPosition(PARAMS, new Date(maghrib.getTime() + 60_000));
    expect(info.isNight).toBe(true);
    expect(info.fraction).toBeGreaterThan(0.9);
    expect(info.fraction).toBeLessThanOrEqual(1);
  });

  it("shows the moon just before Sunrise, near the left (fraction ~0)", () => {
    const day = cairoDay();
    const sunrise = day.instants.find((i) => i.key === "sunrise")!.time as Date;
    const info = getArcPosition(PARAMS, new Date(sunrise.getTime() - 60_000));
    expect(info.isNight).toBe(true);
    expect(info.fraction).toBeGreaterThanOrEqual(0);
    expect(info.fraction).toBeLessThan(0.1);
  });

  it("is night (moon) before Sunrise (pre-dawn) and after Maghrib", () => {
    const day = cairoDay();
    const fajr = day.instants.find((i) => i.key === "fajr")!.time as Date;
    const isha = day.instants.find((i) => i.key === "isha")!.time as Date;
    // Pre-dawn: after Fajr but before Sunrise → still night (the sun is not up).
    const preDawn = getArcPosition(PARAMS, new Date(fajr.getTime() + 60_000));
    expect(preDawn.isNight).toBe(true);
    // After Isha (well after Maghrib) → night.
    const afterIsha = getArcPosition(PARAMS, new Date(isha.getTime() + 60_000));
    expect(afterIsha.isNight).toBe(true);
  });

  it("moon descends from the right toward the left as the night advances", () => {
    const day = cairoDay();
    const maghrib = day.instants.find((i) => i.key === "maghrib")!.time as Date;
    const early = getArcPosition(PARAMS, new Date(maghrib.getTime() + 60 * 60_000)).fraction;
    const late = getArcPosition(PARAMS, new Date(maghrib.getTime() + 4 * 60 * 60_000)).fraction;
    // Travelling right(1)→left(0), so the fraction decreases over the night.
    expect(late).toBeLessThan(early);
  });
});
