import { describe, expect, it } from "vitest";

import { computePrayerTimes, getArcPosition } from "./compute";

// Cairo-ish coordinates + a fixed date give deterministic instants.
const INPUT = {
  lat: 30.0444,
  lng: 31.2357,
  method: "Egyptian" as const,
  madhab: "standard" as const,
};

function instant(now: Date, key: string): Date {
  const day = computePrayerTimes({ ...INPUT, date: now });
  const t = day.instants.find((i) => i.key === key)?.time;
  if (t == null) throw new Error(`no ${key}`);
  return t;
}

describe("getArcPosition day/night band split", () => {
  it("rides the day arc (not the night band) at midday", () => {
    const dhuhr = instant(new Date("2026-06-21T00:00:00Z"), "dhuhr");
    const arc = getArcPosition(INPUT, dhuhr);
    expect(arc.isNight).toBe(false);
    expect(arc.onNightBand).toBe(false);
  });

  it("keeps the moon on the day arc between Maghrib and Isha (no axis jump)", () => {
    const day0 = new Date("2026-06-21T00:00:00Z");
    const maghrib = instant(day0, "maghrib");
    const mid = new Date(maghrib.getTime() + 60 * 1000); // just after sunset
    const arc = getArcPosition(INPUT, mid);
    expect(arc.isNight).toBe(true); // it's the moon
    expect(arc.onNightBand).toBe(false); // ...but still on the sun's axis
  });

  it("drops the moon to the night band after Isha", () => {
    const day0 = new Date("2026-06-21T00:00:00Z");
    const isha = instant(day0, "isha");
    const after = new Date(isha.getTime() + 60 * 1000);
    const arc = getArcPosition(INPUT, after);
    expect(arc.isNight).toBe(true);
    expect(arc.onNightBand).toBe(true);
  });
});

describe("getArcPosition dawn leg (Fajr → Shrouq)", () => {
  const day0 = new Date("2026-06-21T00:00:00Z");

  // Fajr→Isha fraction of an instant — same anchoring buildArcDots uses to place
  // the dots, so the moon lands exactly on the Fajr/Sunrise dots.
  function dotFraction(now: Date, key: string): number {
    const day = computePrayerTimes({ ...INPUT, date: now });
    const fajr = day.instants.find((i) => i.key === "fajr")!.time!;
    const isha = day.instants.find((i) => i.key === "isha")!.time!;
    const t = day.instants.find((i) => i.key === key)!.time!;
    return (t.getTime() - fajr.getTime()) / (isha.getTime() - fajr.getTime());
  }

  it("stands the moon on the Fajr dot at Fajr time", () => {
    const fajr = instant(day0, "fajr");
    const arc = getArcPosition(INPUT, new Date(fajr.getTime() + 1000));
    expect(arc.isNight).toBe(true); // still the moon
    expect(arc.fraction).toBeLessThan(0.02); // on the Fajr dot (fraction ~0)
  });

  it("climbs from the Fajr dot toward the Shrouq dot during dawn", () => {
    const fajr = instant(day0, "fajr");
    const sunrise = instant(day0, "sunrise");
    const mid = new Date((fajr.getTime() + sunrise.getTime()) / 2);
    const sunriseFrac = dotFraction(mid, "sunrise");
    const arc = getArcPosition(INPUT, mid);
    expect(arc.isNight).toBe(true);
    expect(arc.fraction).toBeGreaterThan(0);
    expect(arc.fraction).toBeLessThan(sunriseFrac);
  });

  it("hands the moon off to the sun on the Shrouq dot (no jump)", () => {
    const sunrise = instant(day0, "sunrise");
    const before = getArcPosition(INPUT, new Date(sunrise.getTime() - 1000));
    const after = getArcPosition(INPUT, new Date(sunrise.getTime() + 1000));
    expect(before.isNight).toBe(true); // moon just before sunrise
    expect(after.isNight).toBe(false); // sun just after
    // Same axis (day arc) + same fraction → seamless swap on the Shrouq dot.
    expect(before.onNightBand).toBe(false);
    expect(Math.abs(before.fraction - after.fraction)).toBeLessThan(0.01);
  });
});
