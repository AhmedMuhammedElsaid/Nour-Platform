import { describe, expect, it } from "vitest";

import { computePrayerTimes, getArcPosition } from "./compute";

// Cairo-ish coordinates + a fixed date give deterministic instants.
const INPUT = {
  lat: 30.0444,
  lng: 31.2357,
  method: "Egyptian" as const,
  madhab: "standard" as const,
};

// getArcPosition now sources its day through a resolver (single source of truth
// with the arc dots + adhan). In these tests the resolver is the same adhan-js
// computation `instant()` reads, so positions line up exactly.
const resolve = (date: Date) => computePrayerTimes({ ...INPUT, date });

function instant(now: Date, key: string): Date {
  const day = computePrayerTimes({ ...INPUT, date: now });
  const t = day.instants.find((i) => i.key === key)?.time;
  if (t == null) throw new Error(`no ${key}`);
  return t;
}

describe("getArcPosition day/night band split", () => {
  it("rides the day arc (not the night band) at midday", () => {
    const dhuhr = instant(new Date("2026-06-21T00:00:00Z"), "dhuhr");
    const arc = getArcPosition(resolve, dhuhr);
    expect(arc.isNight).toBe(false);
    expect(arc.onNightBand).toBe(false);
  });

  it("keeps the moon on the day arc between Maghrib and Isha (no axis jump)", () => {
    const day0 = new Date("2026-06-21T00:00:00Z");
    const maghrib = instant(day0, "maghrib");
    const mid = new Date(maghrib.getTime() + 60 * 1000); // just after sunset
    const arc = getArcPosition(resolve, mid);
    expect(arc.isNight).toBe(true); // it's the moon
    expect(arc.onNightBand).toBe(false); // ...but still on the sun's axis
  });

  it("drops the moon to the night band after Isha", () => {
    const day0 = new Date("2026-06-21T00:00:00Z");
    const isha = instant(day0, "isha");
    const after = new Date(isha.getTime() + 60 * 1000);
    const arc = getArcPosition(resolve, after);
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
    const arc = getArcPosition(resolve, new Date(fajr.getTime() + 1000));
    expect(arc.isNight).toBe(true); // still the moon
    expect(arc.fraction).toBeLessThan(0.02); // on the Fajr dot (fraction ~0)
  });

  it("climbs from the Fajr dot toward the Shrouq dot during dawn", () => {
    const fajr = instant(day0, "fajr");
    const sunrise = instant(day0, "sunrise");
    const mid = new Date((fajr.getTime() + sunrise.getTime()) / 2);
    const sunriseFrac = dotFraction(mid, "sunrise");
    const arc = getArcPosition(resolve, mid);
    expect(arc.isNight).toBe(true);
    expect(arc.fraction).toBeGreaterThan(0);
    expect(arc.fraction).toBeLessThan(sunriseFrac);
  });

  it("hands the moon off to the sun on the Shrouq dot (no jump)", () => {
    const sunrise = instant(day0, "sunrise");
    const before = getArcPosition(resolve, new Date(sunrise.getTime() - 1000));
    const after = getArcPosition(resolve, new Date(sunrise.getTime() + 1000));
    expect(before.isNight).toBe(true); // moon just before sunrise
    expect(after.isNight).toBe(false); // sun just after
    // Same axis (day arc) + same fraction → seamless swap on the Shrouq dot.
    expect(before.onNightBand).toBe(false);
    expect(Math.abs(before.fraction - after.fraction)).toBeLessThan(0.01);
  });
});

// Regression for the reported bug: the moon must use the SAME day source as the
// arc dots + the adhan, not a second adhan-js computation. Official (Aladhan) Fajr
// can land a minute earlier than adhan-js; at the instant the adhan fires the moon
// was stuck in the pre-dawn night band — sitting *before* the Fajr dot — because
// getArcPosition recomputed a later Fajr. Sourcing from the resolver fixes it.
describe("getArcPosition single source of truth", () => {
  // A fixed "official" day — deliberately unrelated to adhan-js for INPUT, with a
  // Fajr that a second computation would NOT reproduce.
  const officialDay = (date: Date) => {
    const at = (h: number, m: number) =>
      new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m, 0, 0);
    return {
      date,
      instants: [
        { key: "fajr" as const, time: at(3, 0) },
        { key: "sunrise" as const, time: at(4, 30) },
        { key: "dhuhr" as const, time: at(12, 0) },
        { key: "asr" as const, time: at(15, 30) },
        { key: "maghrib" as const, time: at(19, 0) },
        { key: "isha" as const, time: at(20, 30) },
      ],
    };
  };

  it("puts the moon on the dawn leg the instant the resolver's Fajr passes", () => {
    const day0 = new Date(2026, 5, 21);
    const officialFajr = officialDay(day0).instants[0]!.time!;
    // One second after the official Fajr the adhan has fired — the moon must be on
    // the dawn leg (climbing Fajr→Shrouq), NOT the pre-dawn night band.
    const arc = getArcPosition(officialDay, new Date(officialFajr.getTime() + 1000));
    expect(arc.isNight).toBe(true); // still the moon (before sunrise)
    expect(arc.onNightBand).toBe(false); // dawn leg, not stuck below the Fajr dot
    expect(arc.fraction).toBeLessThan(0.02); // standing on the Fajr dot
  });

  it("follows the resolver's times, not an adhan-js recomputation", () => {
    const day0 = new Date(2026, 5, 21);
    // Just before official Fajr it is still pre-dawn (night band); just after, the
    // dawn leg. The flip happens exactly at the resolver's Fajr — proving the moon
    // and the dots share one clock.
    const officialFajr = officialDay(day0).instants[0]!.time!;
    const before = getArcPosition(officialDay, new Date(officialFajr.getTime() - 1000));
    const after = getArcPosition(officialDay, new Date(officialFajr.getTime() + 1000));
    expect(before.onNightBand).toBe(true); // pre-dawn night band
    expect(after.onNightBand).toBe(false); // dawn leg the moment Fajr passes
  });
});
