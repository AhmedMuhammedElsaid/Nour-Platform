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
