import { describe, expect, it } from "vitest";

import {
  computePrayerTimes,
  getNextPrayer,
  getUpcomingPrayer,
  getDayProgress,
  getArcPosition,
  type PrayerDay,
  type PrayerKey,
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
  // getArcPosition takes a day resolver (single source of truth with the dots +
  // adhan). Here it is the same adhan-js computation the assertions read.
  const resolveDay = (date: Date): PrayerDay =>
    computePrayerTimes({ ...CAIRO, date, method: "Egyptian", madhab: "standard" });

  it("is the sun (not night) during the day — Sunrise → Maghrib", () => {
    const day = cairoDay();
    const sunrise = day.instants.find((i) => i.key === "sunrise")!.time as Date;
    const maghrib = day.instants.find((i) => i.key === "maghrib")!.time as Date;

    // Just after Sunrise — sun visible, near the Sunrise dot (small but non-zero
    // fraction since Sunrise sits after Fajr on the Fajr→Isha dot track).
    const dawn = getArcPosition(resolveDay, new Date(sunrise.getTime() + 60_000));
    expect(dawn.isNight).toBe(false);
    expect(dawn.fraction).toBeGreaterThanOrEqual(0);
    expect(dawn.fraction).toBeLessThan(0.2);

    // Just before Maghrib — sun visible, near the Maghrib dot.
    const dusk = getArcPosition(resolveDay, new Date(maghrib.getTime() - 60_000));
    expect(dusk.isNight).toBe(false);
    expect(dusk.fraction).toBeGreaterThan(0.8);
    expect(dusk.fraction).toBeLessThanOrEqual(1);
  });

  // The day track fraction of an instant (Fajr→Isha), matching buildArcDots.
  const dotFraction = (key: PrayerKey): number => {
    const day = cairoDay();
    const fajr = day.instants.find((i) => i.key === "fajr")!.time as Date;
    const isha = day.instants.find((i) => i.key === "isha")!.time as Date;
    const t = day.instants.find((i) => i.key === key)!.time as Date;
    return (t.getTime() - fajr.getTime()) / (isha.getTime() - fajr.getTime());
  };

  it("rises the moon ON the Maghrib dot just after Maghrib (not the far-right Isha horizon)", () => {
    const day = cairoDay();
    const maghrib = day.instants.find((i) => i.key === "maghrib")!.time as Date;
    const info = getArcPosition(resolveDay, new Date(maghrib.getTime() + 60_000));
    expect(info.isNight).toBe(true);
    // Sits on the Maghrib dot (~0.85), NOT pinned to the Isha horizon (1.0).
    expect(info.fraction).toBeCloseTo(dotFraction("maghrib"), 2);
    expect(info.fraction).toBeLessThan(1);
  });

  it("sets the moon ON the Sunrise dot just before Sunrise (Shrouq)", () => {
    const day = cairoDay();
    const sunrise = day.instants.find((i) => i.key === "sunrise")!.time as Date;
    const info = getArcPosition(resolveDay, new Date(sunrise.getTime() - 60_000));
    expect(info.isNight).toBe(true);
    // Lands on the Sunrise/Shrouq dot, where the sun is about to rise.
    expect(info.fraction).toBeCloseTo(dotFraction("sunrise"), 2);
  });

  it("is night (moon) before Sunrise (pre-dawn) and after Maghrib", () => {
    const day = cairoDay();
    const fajr = day.instants.find((i) => i.key === "fajr")!.time as Date;
    const isha = day.instants.find((i) => i.key === "isha")!.time as Date;
    // Pre-dawn: after Fajr but before Sunrise → still night (the sun is not up).
    const preDawn = getArcPosition(resolveDay, new Date(fajr.getTime() + 60_000));
    expect(preDawn.isNight).toBe(true);
    // After Isha (well after Maghrib) → night.
    const afterIsha = getArcPosition(resolveDay, new Date(isha.getTime() + 60_000));
    expect(afterIsha.isNight).toBe(true);
  });

  it("moon descends from the right toward the left as the night advances", () => {
    const day = cairoDay();
    const maghrib = day.instants.find((i) => i.key === "maghrib")!.time as Date;
    const early = getArcPosition(resolveDay, new Date(maghrib.getTime() + 60 * 60_000)).fraction;
    const late = getArcPosition(resolveDay, new Date(maghrib.getTime() + 4 * 60 * 60_000)).fraction;
    // Travelling Maghrib dot → Sunrise dot, so the fraction decreases over the night.
    expect(late).toBeLessThan(early);
  });
});
